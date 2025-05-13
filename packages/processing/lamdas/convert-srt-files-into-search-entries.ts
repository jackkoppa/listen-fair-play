import * as path from 'path';
import * as fs from 'fs/promises'; // For local DB file operations
import { Document } from 'flexsearch';
import sqlite3 from "sqlite3";
import Database from 'flexsearch/db/sqlite';
import { SEARCH_INDEX_DB_S3_KEY, LOCAL_DB_PATH } from '@listen-fair-play/constants';
import { createDocumentIndex, log } from '@listen-fair-play/utils';
import { SearchEntry } from '@listen-fair-play/types';
import {
  fileExists, 
  getFile, 
  saveFile, 
  listFiles,
  createDirectory
} from '@listen-fair-play/utils'
import { convertSrtFileIntoSearchEntryArray } from '../utils/indexing/convert-srt-file-into-search-entry-array.js';

// Constants - S3 paths
const TRANSCRIPTS_DIR_PREFIX = 'transcripts/';
const SEARCH_ENTRIES_DIR_PREFIX = 'search-entries/';

// Function to check if search entries already exist for a transcript
async function searchEntriesExist(srtFileKey: string): Promise<boolean> {
  const srtFileName = path.basename(srtFileKey, '.srt');
  const podcastName = path.basename(path.dirname(srtFileKey));
  const searchEntriesKey = path.join(SEARCH_ENTRIES_DIR_PREFIX, podcastName, `${srtFileName}.json`);
  
  return fileExists(searchEntriesKey);
}

// Function to get all SRT files with no search entries
async function getSrtFilesWithNoSearchEntries(): Promise<string[]> {
  // List all SRT files
  const transcriptFiles = await listFiles(TRANSCRIPTS_DIR_PREFIX);
  const srtFiles = transcriptFiles.filter(file => file.endsWith('.srt'));
  
  // Filter to only include files with no existing search entries
  const filesToProcess: string[] = [];
  
  for (const srtFile of srtFiles) {
    const hasSearchEntries = await searchEntriesExist(srtFile);
    if (!hasSearchEntries) {
      filesToProcess.push(srtFile);
    }
  }
  
  return filesToProcess;
}

// Function to extract episode information from SRT file path
function extractEpisodeInfo(srtFilePath: string): { episodeId: number; episodeTitle: string } {
  // Example path: transcripts/podcast-name/YYYY-MM-DD_episode-title.srt
  const filename = path.basename(srtFilePath, '.srt');
  const podcastName = path.basename(path.dirname(srtFilePath));
  
  // Generate a simple deterministic hash for the episodeId
  // This ensures consistency when reprocessing the same file
  const combinedString = `${podcastName}_${filename}`;
  let hash = 0;
  for (let i = 0; i < combinedString.length; i++) {
    const char = combinedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Make sure it's positive and reasonable sized
  const episodeId = Math.abs(hash) % 10000;
  
  return {
    episodeId,
    episodeTitle: filename
  };
}

// Function to process a single SRT file
async function processSrtFile(srtFileKey: string): Promise<SearchEntry[]> {
  log.debug(`Processing SRT file: ${srtFileKey}`);
  
  // Get the SRT file content
  const srtBuffer = await getFile(srtFileKey);
  const srtContent = srtBuffer.toString('utf-8');
  
  // Extract episode info from file path
  const { episodeId, episodeTitle } = extractEpisodeInfo(srtFileKey);
  
  // Convert SRT content to search entries using the utility function
  const utilityEntries = convertSrtFileIntoSearchEntryArray({
    srtFileContent: srtContent,
    episodeId,
    episodeTitle
  });
  
  // Convert entries to our SearchEntry type to ensure index signature is included
  const searchEntries: SearchEntry[] = utilityEntries.map(entry => ({
    ...entry
  }));
  
  log.debug(`Generated ${searchEntries.length} search entries from SRT file`);
  
  // Save search entries to S3
  const srtFileName = path.basename(srtFileKey, '.srt');
  const podcastName = path.basename(path.dirname(srtFileKey));
  const searchEntriesKey = path.join(SEARCH_ENTRIES_DIR_PREFIX, podcastName, `${srtFileName}.json`);
  
  // Ensure the directory exists
  await createDirectory(path.dirname(searchEntriesKey));
  
  // Save search entries as a JSON array
  await saveFile(searchEntriesKey, JSON.stringify(searchEntries, null, 2));
  
  log.info(`Saved ${searchEntries.length} search entries to: ${searchEntriesKey}`);
  
  return searchEntries;
}

// Function to create and export FlexSearch index
async function createAndExportFlexSearchIndex(allSearchEntries: SearchEntry[]): Promise<void> {
  log.debug(`Creating FlexSearch index with ${allSearchEntries.length} entries`);

  // Ensure the local /tmp/ directory is available for the SQLite DB
  try {
    await fs.access('/tmp');
  } catch (error) {
    log.error("Local /tmp directory is not accessible for SQLite DB.", error);
    await fs.mkdir('/tmp', { recursive: true }); // Try to create it if it doesn't exist
    log.info("Created /tmp directory.");
  }
  
  // Delete old local DB file if it exists, to start fresh
  try {
    await fs.unlink(LOCAL_DB_PATH);
    log.debug(`Deleted existing local SQLite DB at ${LOCAL_DB_PATH}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') { // ENOENT means file not found, which is fine
      log.warn(`Could not delete existing local SQLite DB: ${error.message}`);
    }
  }

  const sqlite3DB = new sqlite3.Database(LOCAL_DB_PATH);

  const index = await createDocumentIndex(sqlite3DB);
  
  // Add all search entries to the index
  const totalEntries = allSearchEntries.length;
  let processedCount = 0;
  let lastLoggedPercentage = 0;
  const startTime = Date.now();

  for (const entry of allSearchEntries) {
    index.add(entry);

    log.info(`Added entry ${entry.id}, ${entry.episodeTitle} to index`);

    processedCount++;
    
    // Calculate current percentage
    const currentPercentage = Math.floor((processedCount / totalEntries) * 100);
    
    // Log at each 5% increment
    if (currentPercentage >= lastLoggedPercentage + 5) {
      lastLoggedPercentage = Math.floor(currentPercentage / 5) * 5;
      const elapsedTime = (Date.now() - startTime) / 1000;
      log.info(`Indexing progress: ${lastLoggedPercentage}% (${processedCount}/${totalEntries} entries) - Elapsed time: ${elapsedTime.toFixed(2)}s`);
      const commitStart = Date.now();
      log.info(`Committing index to DB...`);
      await index.commit();
      log.info(`Committed index to DB in ${((Date.now() - commitStart) / 1000).toFixed(2)}s`);
    }
  }
  
  // Ensure we log 100% completion
  if (lastLoggedPercentage < 100 && totalEntries > 0) {
    const elapsedTime = (Date.now() - startTime) / 1000;
    log.info(`Indexing progress: 100% (${totalEntries}/${totalEntries} entries) - Elapsed time: ${elapsedTime.toFixed(2)}s`);
  }
  
  log.info('Will commit FlexSearch index changes to local SQLite DB.');
  await index.commit(); // Explicitly commit if needed by the adapter.
  log.info('FlexSearch index changes committed to local SQLite DB.');

  const tableNames = [
    'map_text',
    'ctx_text',
    'reg',
    'tag_text',
    'cfg_text',
    'sqlite_stat1'
  ];

  if (tableNames.length > 0) {
    const tableQueries = tableNames.map(tableName => `SELECT '${tableName}' as table_name, COUNT(*) as count FROM ${tableName}`).join(' UNION ALL ');
    sqlite3DB.all(tableQueries, function(err, rows) {
      if (err) {
        log.warn('Error counting rows in tables:', err);
      } else {
        rows.forEach((row: any) => {
          log.info(`Number of rows in ${row.table_name} table:`, row.count);
        });
      }
    });
  }
  
  // Upload the SQLite DB file to S3
  log.info(`Uploading SQLite DB from ${LOCAL_DB_PATH} to S3 at ${SEARCH_INDEX_DB_S3_KEY}...`);
  const dbFileBuffer = await fs.readFile(LOCAL_DB_PATH);
  await saveFile(SEARCH_INDEX_DB_S3_KEY, dbFileBuffer);
  
  const totalElapsedTime = (Date.now() - startTime) / 1000;
  log.info(`FlexSearch index successfully created as SQLite DB and exported to S3: ${SEARCH_INDEX_DB_S3_KEY} - Total elapsed time: ${totalElapsedTime.toFixed(2)}s`);

  // Clean up local DB file after upload
  try {
    await fs.unlink(LOCAL_DB_PATH);
    log.info(`Cleaned up local SQLite DB file: ${LOCAL_DB_PATH}`);
  } catch (error: any) {
    log.warn(`Could not clean up local SQLite DB file: ${error.message}`);
  }
}

// Function to collect all existing search entries
async function getAllSearchEntries(): Promise<SearchEntry[]> {
  const searchEntryFiles = await listFiles(SEARCH_ENTRIES_DIR_PREFIX);
  const jsonFiles = searchEntryFiles.filter(file => file.endsWith('.json'));
  
  let allEntries: SearchEntry[] = [];
  
  for (const jsonFile of jsonFiles) {
    const fileBuffer = await getFile(jsonFile);
    const fileContent = fileBuffer.toString('utf-8');
    
    try {
      // Parse the file content as a JSON array of SearchEntry objects
      const parsedEntries = JSON.parse(fileContent);
      if (Array.isArray(parsedEntries)) {
        // Convert to our SearchEntry type to ensure index signature
        const entries: SearchEntry[] = parsedEntries.map(entry => ({
          ...entry
        }));
        allEntries = allEntries.concat(entries);
      } else {
        log.warn(`Unexpected format in ${jsonFile} - expected array but got:`, typeof parsedEntries);
      }
    } catch (error) {
      log.error(`Error parsing JSON from ${jsonFile}:`, error);
    }
  }
  
  return allEntries;
}

// Main handler function
export async function handler(event: any = {}): Promise<any> {
  log.debug('Starting SRT to search index entries conversion at', new Date().toISOString());
  
  // Check if we should force processing all SRT files (debug mode)
  const forceReprocessAll = event.forceReprocessAll === true;
  if (forceReprocessAll) {
    log.debug('Debug mode: Forcing reprocessing of all SRT files');
  }
  
  try {
    // Ensure the search index entries directory exists
    await createDirectory(SEARCH_ENTRIES_DIR_PREFIX);
    
    // Get SRT files to process - either all or only new ones
    let srtFilesToProcess: string[];
    
    if (forceReprocessAll) {
      // Get all SRT files regardless of whether they've been processed before
      const transcriptFiles = await listFiles(TRANSCRIPTS_DIR_PREFIX);
      srtFilesToProcess = transcriptFiles.filter(file => file.endsWith('.srt'));
    } else {
      // Get only SRT files that don't have search entries yet
      srtFilesToProcess = await getSrtFilesWithNoSearchEntries();
    }
    
    log.debug(`Found ${srtFilesToProcess.length} SRT files to process`);
    
    if (srtFilesToProcess.length === 0) {
      log.debug('No SRT files to process');
      return { processed: 0 };
    }
    
    // Process each SRT file
    const processPromises = srtFilesToProcess.map(processSrtFile);
    const newSearchEntries = await Promise.all(processPromises);
    const flattenedNewEntries = newSearchEntries.flat();
    
    // Get all existing search entries - only those not being reprocessed
    let existingEntries: SearchEntry[] = [];
    if (!forceReprocessAll) {
      existingEntries = await getAllSearchEntries();
    }
    
    // Combine all entries and create the FlexSearch index
    const allEntries = [...existingEntries, ...flattenedNewEntries];
    await createAndExportFlexSearchIndex(allEntries);
    
    return {
      processed: srtFilesToProcess.length,
      entriesAdded: flattenedNewEntries.length,
      totalEntries: allEntries.length
    };
  } catch (error) {
    log.error('Error processing SRT files:', error);
    throw error;
  }
}

// If running directly (ESM compatible approach)
// In ESM, import.meta.url will be defined and can be compared to process.argv[1]
if (import.meta.url === `file://${process.argv[1]}`) {
  handler()
    .then(result => log.debug('Completed with result:', result))
    .catch(err => log.error('Failed with error:', err));
}