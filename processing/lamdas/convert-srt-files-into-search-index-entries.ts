// TODO: Implement
// This lambda function will be triggered after additional SRT transcripts are uploaded to S3
// It will read the SRT files from S3, convert them into a JSON format that can be used by the search lambda, and then upload the JSON files to S3
// It will use `/processing/utils/convert-srt-to-search-index-entry.ts` to convert the SRT files into search index entries 

// The search index entries will be stored in S3, next to `/audio` and `/transcripts` - we'll store them in a folder called `/search-index-entries`
// Each SRT file will be converted into one JSON file, with the same name as the SRT file
// Finally, at the end of every lambda function, we'll re-generate the latest flexsearch index, to include all existing & new search index entries 
// See docs here for exporting the flexsearch index: https://github.com/nextapps-de/flexsearch/blob/master/doc/export-import.md 

// The lambda function at `/search/lambdas/search-indexed-transcripts.ts` will always start by importing the latest flexsearch index, before executing a search query,
// it will retrieve that index from S3 when it's first cold started

import * as path from 'path';
import { Document } from 'flexsearch';
import { 
  fileExists, 
  getFile, 
  saveFile, 
  listFiles,
  createDirectory
} from '../utils/s3/aws-s3-client.js';
import { convertSrtFileIntoSearchEntryArray } from '../utils/search/convert-srt-file-into-search-entry-array.js';

// Constants - S3 paths
const TRANSCRIPTS_DIR_PREFIX = 'transcripts/';
const SEARCH_INDEX_ENTRIES_DIR_PREFIX = 'search-index-entries/';
const SEARCH_INDEX_DIR_PREFIX = 'search-index/';
const FLEXSEARCH_INDEX_KEY = path.join(SEARCH_INDEX_DIR_PREFIX, 'flexsearch-index.json');

// Define search entry type to match the utility function's output
// Use the same structure but add index signature needed for FlexSearch
interface SearchEntry {
  id: string;
  episodeId: number;
  episodeTitle: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  [key: string]: string | number; // Add index signature for FlexSearch Document
}

// Function to check if search entries already exist for a transcript
async function searchEntriesExist(srtFileKey: string): Promise<boolean> {
  const srtFileName = path.basename(srtFileKey, '.srt');
  const podcastName = path.basename(path.dirname(srtFileKey));
  const searchEntriesKey = path.join(SEARCH_INDEX_ENTRIES_DIR_PREFIX, podcastName, `${srtFileName}.json`);
  
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
  console.log(`Processing SRT file: ${srtFileKey}`);
  
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
  
  console.log(`Generated ${searchEntries.length} search entries from SRT file`);
  
  // Save search entries to S3
  const srtFileName = path.basename(srtFileKey, '.srt');
  const podcastName = path.basename(path.dirname(srtFileKey));
  const searchEntriesKey = path.join(SEARCH_INDEX_ENTRIES_DIR_PREFIX, podcastName, `${srtFileName}.json`);
  
  // Ensure the directory exists
  await createDirectory(path.dirname(searchEntriesKey));
  
  // Save search entries as a JSON array
  await saveFile(searchEntriesKey, JSON.stringify(searchEntries, null, 2));
  
  console.log(`Saved ${searchEntries.length} search entries to: ${searchEntriesKey}`);
  
  return searchEntries;
}

// Function to create and export FlexSearch index
async function createAndExportFlexSearchIndex(allSearchEntries: SearchEntry[]): Promise<void> {
  console.log(`Creating FlexSearch index with ${allSearchEntries.length} entries`);
  
  // Create FlexSearch Document index
  const index = new Document({
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
  
  // Add all search entries to the index
  for (const entry of allSearchEntries) {
    index.add(entry);
  }
  
  // Ensure the search index directory exists
  await createDirectory(SEARCH_INDEX_DIR_PREFIX);
  
  // Export the index
  console.log('Exporting FlexSearch index...');
  
  const exportedData: Record<string, string> = {};
  
  // Use type assertion to access the export function
  const exportFunction = (index as any).export as (
    callback: (key: string, data: any) => Promise<void>
  ) => Promise<void>;
  
  // Export the index safely using a callback that returns a promise
  await exportFunction(async (key, data) => {
    exportedData[key] = data || '';
  });
  
  // Save the exported index to S3
  await saveFile(FLEXSEARCH_INDEX_KEY, JSON.stringify(exportedData));
  
  console.log(`FlexSearch index successfully exported to: ${FLEXSEARCH_INDEX_KEY}`);
}

// Function to collect all existing search entries
async function getAllSearchEntries(): Promise<SearchEntry[]> {
  const searchEntryFiles = await listFiles(SEARCH_INDEX_ENTRIES_DIR_PREFIX);
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
        console.warn(`Unexpected format in ${jsonFile} - expected array but got:`, typeof parsedEntries);
      }
    } catch (error) {
      console.error(`Error parsing JSON from ${jsonFile}:`, error);
    }
  }
  
  return allEntries;
}

// Main handler function
export async function handler(event: any = {}): Promise<any> {
  console.log('Starting SRT to search index entries conversion at', new Date().toISOString());
  console.log('Event:', JSON.stringify(event));
  
  // Check if we should force processing all SRT files (debug mode)
  const forceReprocessAll = event.forceReprocessAll === true;
  if (forceReprocessAll) {
    console.log('Debug mode: Forcing reprocessing of all SRT files');
  }
  
  try {
    // Ensure the search index entries directory exists
    await createDirectory(SEARCH_INDEX_ENTRIES_DIR_PREFIX);
    
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
    
    console.log(`Found ${srtFilesToProcess.length} SRT files to process`);
    
    if (srtFilesToProcess.length === 0) {
      console.log('No SRT files to process');
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
    console.error('Error processing SRT files:', error);
    throw error;
  }
}

// If running directly (ESM compatible approach)
// In ESM, import.meta.url will be defined and can be compared to process.argv[1]
if (import.meta.url === `file://${process.argv[1]}`) {
  handler()
    .then(result => console.log('Completed with result:', result))
    .catch(err => console.error('Failed with error:', err));
}