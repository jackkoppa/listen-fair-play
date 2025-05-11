// CURSOR-TODO: Switch this file to use SQLite via FlexSearch's SQLite adapter
// https://github.com/nextapps-de/flexsearch/blob/master/doc/persistent-sqlite.md
// On AWS Lambda, we'll save the SQLite database to S3 and load it on every lambda cold start

import * as fs from 'fs/promises'; // For local DB file operations
import { Document } from 'flexsearch';
import sqlite3 from "sqlite3";
import Database from 'flexsearch/db/sqlite';
import { SEARCH_INDEX_DB_S3_KEY, LOCAL_DB_PATH, SQLITE_DB_NAME } from '@listen-fair-play/constants';
import { log } from '@listen-fair-play/utils';
import { 
  getFile,
  // directoryExists, // No longer needed for a single DB file
  // listFiles // No longer needed for a single DB file
  fileExists // To check if the DB file exists in S3
} from '../../processing/utils/s3/aws-s3-client.js';

// Keep the flexsearch index in memory for reuse between lambda invocations
// The type for Document with a DB adapter might be just Document, or Document<..., ..., SqliteAdapter>
// For now, using 'any' for the adapter part if StorageInterface is not directly compatible.
let flexSearchIndex: Document<any, any, any> | null = null;

// Define the structure for a search entry
interface SearchEntry {
  id: string;
  episodeId: number;
  episodeTitle: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  [key: string]: string | number;
}

// Define the search request body structure
interface SearchRequest {
  query: string;
  limit?: number;
  searchFields?: string[];
  suggest?: boolean;
  matchAllFields?: boolean;
}

// Define the search response structure
interface SearchResponse {
  hits: SearchEntry[];
  totalHits: number;
  processingTimeMs: number;
  query: string;
}

/**
 * Initialize the FlexSearch index from S3
 */
async function initializeFlexSearchIndex(): Promise<Document<any, any, any>> {
  if (flexSearchIndex) {
    return flexSearchIndex;
  }

  log.debug('Initializing FlexSearch index from S3 SQLite database...');
  const startTime = Date.now();

  // Ensure the local /tmp/ directory is available
  try {
    await fs.access('/tmp');
  } catch (error) {
    log.warn("Local /tmp directory is not accessible, attempting to create.", error);
    await fs.mkdir('/tmp', { recursive: true });
    log.info("Created /tmp directory.");
  }

  // Check if the index DB file exists in S3
  const indexDbExistsInS3 = await fileExists(SEARCH_INDEX_DB_S3_KEY);
  if (!indexDbExistsInS3) {
    log.warn(`FlexSearch SQLite DB not found in S3 at: ${SEARCH_INDEX_DB_S3_KEY}. Creating an empty index.`);
    // Create and return an empty, non-persistent index if DB not found
    // Or, depending on requirements, this could be an error state.
    flexSearchIndex = createEmptyMemoryIndex(); 
    return flexSearchIndex;
  }

  // Download the SQLite DB file from S3 to the local /tmp path
  log.debug(`Downloading SQLite DB from S3 (${SEARCH_INDEX_DB_S3_KEY}) to local path (${LOCAL_DB_PATH})`);
  try {
    const dbFileBuffer = await getFile(SEARCH_INDEX_DB_S3_KEY);
    await fs.writeFile(LOCAL_DB_PATH, dbFileBuffer);
    log.info(`Successfully downloaded and saved SQLite DB to ${LOCAL_DB_PATH}`);
    // Log the file size of the downloaded SQLite DB file
    try {
      const stats = await fs.stat(LOCAL_DB_PATH);
      log.info(`SQLite DB file size: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      log.warn(`Failed to get file size for SQLite DB at ${LOCAL_DB_PATH}: ${error}`);
    }
  } catch (error) {
    log.error(`Failed to download or save SQLite DB from S3: ${error}. Returning an empty index.`);
    // Fallback to an empty memory index on download/write failure
    flexSearchIndex = createEmptyMemoryIndex();
    return flexSearchIndex;
  }

  // CURSOR-TODO: Can/should the DB initialization move to a /utils file, to be shared with the /search lambda?
  const sqlite3DB = new sqlite3.Database(LOCAL_DB_PATH);

  let tableNames: string[] = [];
  log.info('Checking if the table exists...');
  sqlite3DB.all('SELECT name FROM sqlite_master WHERE type="table"', function(err, rows) {
    if (err) {
      log.warn('Error listing tables in SQLite DB:', err);
    } else {
      tableNames = rows.map((row: any) => row.name);
      log.info('Tables in SQLite DB:', tableNames);
    }
  });

  const tableName = 'cfg_text';
  sqlite3DB.get(`SELECT COUNT(*) as count FROM ${tableName}`, function(err, row: any) {
    if (err) {
      log.warn(`Error counting rows in ${tableName} table:`, err);
    } else {
      log.info(`Number of rows in ${tableName} table:`, row?.count);
    }
  });
  
  // Create FlexSearch Document index with SQLite adapter
  // The adapter will create/use the DB file at LOCAL_DB_PATH
  const db = new Database({
    name: SQLITE_DB_NAME,
    db: sqlite3DB                  // Define a primary key (good practice)
  });                              // Keep 'as any' if type issues with constructor persist

  const index = new Document({
    document: {
      id: 'id',
      index: ['text'],
      store: true, // Ensure documents (or specified fields) are stored for later enrichment.
    },
    tokenize: 'full',
    context: true,
  });

  await index.mount(db);

  
  // It might be necessary to explicitly load or connect the index if the adapter doesn't do it automatically.
  // e.g., await index.load() or similar if such a method exists.
  // For now, assuming Document constructor handles this with the db adapter.
  // A .ready() or .open() call on the adapter or index might be needed.
  // await sqliteAdapter.connect(); // Or similar, if required by the adapter API.

  log.debug(`FlexSearch index loaded from SQLite DB in ${Date.now() - startTime}ms`);
  
  // Cache the index for future invocations
  flexSearchIndex = index;
  
  return index;
}

/**
 * Create an empty FlexSearch index (in-memory) with the proper configuration
 * This is used as a fallback if the SQLite DB cannot be loaded.
 */
function createEmptyMemoryIndex(): Document<any, any, any> {
  log.debug("Creating a new empty in-memory FlexSearch index.");
  return new Document({
    document: {
      id: 'id',
      index: ['text']
    },
    tokenize: 'full',
    context: true
    // No db adapter for a purely in-memory fallback
  });
}

/**
 * Perform a search against the FlexSearch index
 */
async function searchIndex(
  index: Document<any, any, any>, 
  query: string, 
  limit: number = 10, 
  searchFields: string[] = ['text'],
  suggest: boolean = false,
  matchAllFields: boolean = false
): Promise<SearchEntry[]> {
  
  if (!query.trim()) {
    return [];
  }

  let searchResults: SearchEntry[] = [];
  
  if (matchAllFields) {
    // Search all fields and combine results
    log.info('Searching all fields and combining results...');
    const resultsPromises = searchFields.map(field => 
      index.searchAsync(query, {
        limit,
        suggest,
        index: field,
        enrich: true // Ensure documents are enriched
      })
    );
    
    const fieldResultsArray = await Promise.all(resultsPromises);
    
    // Merge and deduplicate results
    const uniqueResults = new Map<string, SearchEntry>();
    
    fieldResultsArray.forEach(fieldResultSet => {
      if (Array.isArray(fieldResultSet)) {
        fieldResultSet.forEach(perFieldResult => {
          if (perFieldResult && Array.isArray(perFieldResult.result)) {
            perFieldResult.result.forEach(hit => {
              if (hit && hit.doc && typeof hit.id === 'string') {
                uniqueResults.set(hit.id, hit.doc);
              }
            });
          }
        });
      }
    });
    
    searchResults = Array.from(uniqueResults.values());
  } else {
    // Search with the specified options
    log.info('about to search for enriched results...', index.search, index.searchAsync, searchFields);
    const enrichedResults = await index.search(query, {
      limit,
      suggest,
      index: searchFields,
      enrich: true // Ensure documents are enriched
    });
    
    console.log('enrichedResults', enrichedResults);
    // Convert the results to SearchEntry[]
    if (Array.isArray(enrichedResults)) {
      searchResults = enrichedResults
        .flatMap(fieldResult => fieldResult.result || [])
        .filter(hit => hit && hit.doc)
        .map(hit => hit.doc);
    }
  }
  
  return searchResults;
}

/**
 * Main Lambda handler function
 */
export async function handler(event: any): Promise<SearchResponse> {
  log.debug('Search request received:', JSON.stringify(event));
  const startTime = Date.now();
  
  try {
    // Initialize the index if needed
    const index = await initializeFlexSearchIndex();
    
    // Extract search parameters from the event
    let query: string = '';
    let limit: number = 10;
    let searchFields: string[] = ['text'];
    let suggest: boolean = false;
    let matchAllFields: boolean = false;
    
    // Handle both GET requests with query parameters and POST requests with a JSON body
    if (event.httpMethod === 'GET') {
      // For API Gateway GET requests
      const queryParams = event.queryStringParameters || {};
      query = queryParams.query || '';
      limit = parseInt(queryParams.limit || '10', 10);
      searchFields = queryParams.fields ? queryParams.fields.split(',') : ['text'];
      suggest = queryParams.suggest === 'true';
      matchAllFields = queryParams.matchAllFields === 'true';
    } else if (event.body) {
      // For direct invocations or POST requests with a body
      const body: SearchRequest = typeof event.body === 'string' 
        ? JSON.parse(event.body) 
        : event.body;
      
      query = body.query || '';
      limit = body.limit || 10;
      searchFields = body.searchFields || ['text'];
      suggest = body.suggest || false;
      matchAllFields = body.matchAllFields || false;
    } else if (typeof event.query === 'string') {
      // For direct invocations with a query property
      query = event.query;
      limit = event.limit || 10;
      searchFields = event.searchFields || ['text'];
      suggest = event.suggest || false;
      matchAllFields = event.matchAllFields || false;
    }
    
    // Perform the search
    const searchResults = await searchIndex(
      index,
      query,
      limit,
      searchFields,
      suggest,
      matchAllFields
    );
    
    // Calculate processing time
    const processingTimeMs = Date.now() - startTime;
    
    // Prepare and return the response
    const response: SearchResponse = {
      hits: searchResults,
      totalHits: searchResults.length,
      processingTimeMs,
      query
    };
    
    return response;
  } catch (error) {
    log.error('Error searching indexed transcripts:', error);
    throw error;
  }
}

// For local testing - ES modules compatible approach
if (import.meta.url === `file://${process.argv[1]}`) {
  const testQuery = 'test query';
  handler({ query: testQuery })
    .then(result => log.debug('Search results:', JSON.stringify(result, null, 2)))
    .catch(err => log.error('Search failed with error:', err));
}
