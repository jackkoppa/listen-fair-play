// TODO: Implement

// This lambda function will be used to search the indexed transcripts for a given query
// It will use flexsearch to search the transcripts: https://github.com/nextapps-de/flexsearch
// It will be triggered by an API Gateway endpoint 

// See code comments in `/processing/convert-srt-files-into-search-index-entries.ts` for more details on how the search index is generated,
// which in this file, we'll retrieve from S3 on every lambda cold start

import * as path from 'path';
import { Document } from 'flexsearch';
import { 
  getFile,
  fileExists
} from '../../processing/utils/s3/aws-s3-client.js';

// Constants - S3 paths
const SEARCH_INDEX_DIR_PREFIX = 'search-index/';
const FLEXSEARCH_INDEX_KEY = path.join(SEARCH_INDEX_DIR_PREFIX, 'flexsearch-index.json');

// Keep the flexsearch index in memory for reuse between lambda invocations
let flexSearchIndex: Document | null = null;

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
async function initializeFlexSearchIndex(): Promise<Document> {
  if (flexSearchIndex) {
    return flexSearchIndex;
  }

  console.log('Initializing FlexSearch index from S3...');
  const startTime = Date.now();

  // Check if the index file exists
  const indexExists = await fileExists(FLEXSEARCH_INDEX_KEY);
  if (!indexExists) {
    console.log(`FlexSearch index file not found at: ${FLEXSEARCH_INDEX_KEY}`);
    // Create and return an empty index
    return createEmptyIndex();
  }

  // Get the serialized index from S3
  const indexFileBuffer = await getFile(FLEXSEARCH_INDEX_KEY);
  const serializedIndex = JSON.parse(indexFileBuffer.toString('utf-8')) as Record<string, string>;

  // Create a new FlexSearch Document instance
  const index = createEmptyIndex();

  // Import the serialized index data
  for (const [key, data] of Object.entries(serializedIndex)) {
    await index.import(key, data);
  }

  console.log(`FlexSearch index loaded in ${Date.now() - startTime}ms`);
  
  // Cache the index for future invocations
  flexSearchIndex = index;
  
  return index;
}

/**
 * Create an empty FlexSearch index with the proper configuration
 */
function createEmptyIndex(): Document {
  return new Document({
    document: {
      id: 'id',
      index: ['text', 'episodeTitle']
    },
    tokenize: 'forward',
    cache: 100, // Cache the last 100 search results
    resolution: 9,
    context: {
      depth: 2,
      resolution: 3,
      bidirectional: true
    }
  });
}

/**
 * Perform a search against the FlexSearch index
 */
async function searchIndex(
  index: Document, 
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
    const resultsPromises = searchFields.map(field => 
      index.search(query, {
        limit,
        suggest,
        index: field
      })
    );
    
    const results = await Promise.all(resultsPromises);
    
    // Merge and deduplicate results
    const uniqueResults = new Map<string, SearchEntry>();
    
    results.forEach(fieldResults => {
      if (Array.isArray(fieldResults)) {
        fieldResults.forEach(result => {
          // Make sure the result is a SearchEntry and has an id
          if (result && typeof result === 'object' && 'id' in result) {
            uniqueResults.set(result.id as string, result as unknown as SearchEntry);
          }
        });
      }
    });
    
    searchResults = Array.from(uniqueResults.values());
  } else {
    // Search with the specified options
    const results = await index.search(query, {
      limit,
      suggest,
      index: searchFields
    });
    
    // Convert the results to SearchEntry[]
    if (Array.isArray(results)) {
      searchResults = results
        .filter(result => result && typeof result === 'object' && 'id' in result)
        .map(result => result as unknown as SearchEntry);
    }
  }
  
  return searchResults;
}

/**
 * Main Lambda handler function
 */
export async function handler(event: any): Promise<SearchResponse> {
  console.log('Search request received:', JSON.stringify(event));
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
    console.error('Error searching indexed transcripts:', error);
    throw error;
  }
}

// For local testing - ES modules compatible approach
if (import.meta.url === `file://${process.argv[1]}`) {
  const testQuery = 'test query';
  handler({ query: testQuery })
    .then(result => console.log('Search results:', JSON.stringify(result, null, 2)))
    .catch(err => console.error('Search failed with error:', err));
}
