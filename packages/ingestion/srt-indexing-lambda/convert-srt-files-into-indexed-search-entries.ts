// Add error handlers at the very top of the file
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// CURSOR-TODO: This file will often take a long time to run, and risks being > the 10 minute limit for AWS Lambda.
// The approach we should take:
// 1. On every run of this file, make sure we're iterating through every single .srt file in S3 /transcripts/
// 2. If the file doesn't yet have an equivalent .json file in S3 /search-entries/, then we should create one, using the existing logic. (this part is fast regardless)
// 3. If the file already has an equivalent .json file in S3 /search-entries/, then we can skip creating that.
// 4. Immediately after, for each file, attempt to index that file into the FlexSearch index.
// 5. For each entry in the .json file, check if entry.id is already in the FlexSearch index. If so, skip it. If not, add it. (this is the part that can slow down)
// (IMPORTANT: We need to re-use the existing SQLite DB file, if it exists - not create it totally fresh)
// 6. Commit the index to the local SQLite DB every 5%
// 7. IF AT ANY POINT, we hit 7 minutes (make this configurable), we should stop the process.
//       8. If we've stopped, then finish creating the index, and save it to the file that we currently do.
//       9. If we've needed to stop, then log the fact that we stopped early, and after saving the index file, TRIGGER A NEW RUN of this same Lambda.
// 10. Once a run is able to fully finish under 7 minutes, then we don't need to re-trigger the Lambda.


import * as path from 'path';
import * as fs from 'fs/promises';
import sqlite3 from "sqlite3";
import { SEARCH_INDEX_DB_S3_KEY, LOCAL_DB_PATH } from '@listen-fair-play/constants';
import { createDocumentIndex, logRowCountsForSQLiteTables } from '@listen-fair-play/database';
import { log } from '@listen-fair-play/logging';
import { SearchEntry } from '@listen-fair-play/types';
import {
  fileExists, 
  getFile, 
  saveFile, 
  listFiles,
  createDirectory
} from '@listen-fair-play/s3'
import { convertSrtFileIntoSearchEntryArray } from './utils/convert-srt-file-into-search-entry-array.js';
import { Lambda } from "@aws-sdk/client-lambda"; // Added for re-triggering

// Constants - S3 paths
const TRANSCRIPTS_DIR_PREFIX = 'transcripts/';
const SEARCH_ENTRIES_DIR_PREFIX = 'search-entries/';

// Configurable constants as per requirements
const PROCESSING_TIME_LIMIT_MINUTES = 7; 
// Give a 30-second buffer before the planned AWS Lambda timeout (currently limiting to 7 minutes above, Lambda max is 15 minutes)
const PROCESSING_TIME_LIMIT_MS = (PROCESSING_TIME_LIMIT_MINUTES * 60 * 1000) - (30 * 1000); 
const MAX_RETRIGGER_COUNT = 5; 
const COMMIT_PERCENTAGE_THRESHOLD = 5; // Commit every 5% of SRT files processed

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
  
  log.debug(`Saved ${searchEntries.length} search entries to: ${searchEntriesKey}`);
  
  return searchEntries;
}

// Function to check if search entries already exist for a transcript
// This function remains useful for determining if a JSON file needs creation, though the main loop will handle it.
async function searchEntriesJsonFileExists(srtFileKey: string): Promise<string | false> {
  const srtFileName = path.basename(srtFileKey, '.srt');
  const podcastName = path.basename(path.dirname(srtFileKey));
  const searchEntriesKey = path.join(SEARCH_ENTRIES_DIR_PREFIX, podcastName, `${srtFileName}.json`);
  
  if (await fileExists(searchEntriesKey)) {
    return searchEntriesKey;
  }
  return false;
}

// Main handler function
export async function handler(event: { previousRunsCount?: number; forceReprocessAll?: boolean } = {}): Promise<any> {
  const lambdaStartTime = Date.now();
  log.info('Starting SRT to search index entries conversion at', new Date().toISOString(), 'Event:', event);

  const currentRunCount = event.previousRunsCount || 0;
  if (currentRunCount > MAX_RETRIGGER_COUNT) {
    const errorMsg = `Exceeded maximum re-trigger count (${MAX_RETRIGGER_COUNT}). Stopping further processing. Index may be incomplete.`;
    log.error(errorMsg);
    // Return a specific error structure or throw, depending on desired behavior for Step Functions/EventBridge
    return {
      status: 'error',
      message: errorMsg,
      evaluatedSrtFiles: 0,
      totalSrtFiles: 0,
      newEntriesAdded: 0,
      timeLimitReached: false,
      retriggered: false,
    };
  }

  try {
    await fs.access('/tmp');
  } catch (error) {
    log.info("Local /tmp directory not accessible or doesn't exist. Creating it.");
    await fs.mkdir('/tmp', { recursive: true });
  }
  
  await createDirectory(SEARCH_ENTRIES_DIR_PREFIX); // Ensure base search entries dir exists

  try {
    if (await fileExists(SEARCH_INDEX_DB_S3_KEY)) {
      log.info(`Found existing DB in S3 (${SEARCH_INDEX_DB_S3_KEY}). Downloading to ${LOCAL_DB_PATH}...`);
      const dbBuffer = await getFile(SEARCH_INDEX_DB_S3_KEY);
      await fs.writeFile(LOCAL_DB_PATH, dbBuffer);
      log.info(`Successfully downloaded and saved existing DB to ${LOCAL_DB_PATH}`);
    } else {
      log.info(`No existing DB found in S3 (${SEARCH_INDEX_DB_S3_KEY}). Will start with a fresh index.`);
      try {
        await fs.unlink(LOCAL_DB_PATH);
        log.debug(`Ensured no stale local DB at ${LOCAL_DB_PATH} before starting fresh.`);
      } catch (e: any) {
        if (e.code !== 'ENOENT') log.warn(`Could not remove potentially stale local DB: ${e.message}`);
      }
    }
  } catch (error: any) {
    log.warn(`Error during S3 DB download/setup: ${error.message}. Will proceed, attempting with a fresh index.`, error);
    try {
        await fs.unlink(LOCAL_DB_PATH);
    } catch (e: any) {
        if (e.code !== 'ENOENT') log.warn(`Could not remove stale local DB after S3 error: ${e.message}`);
    }
  }

  const sqlite3DB = new sqlite3.Database(LOCAL_DB_PATH);
  const index = await createDocumentIndex(sqlite3DB);
  log.info('FlexSearch index initialized.');

  const allTranscriptFiles = await listFiles(TRANSCRIPTS_DIR_PREFIX);
  const srtFilesToEvaluate = allTranscriptFiles.filter(file => file.endsWith('.srt'));
  const totalSrtFiles = srtFilesToEvaluate.length;

  if (totalSrtFiles === 0) {
    log.info("No SRT files found in transcripts directory. Exiting.");
    return { 
        evaluatedSrtFiles: 0, 
        totalSrtFiles: 0, 
        newEntriesAdded: 0, 
        timeLimitReached: false, 
        retriggered: false 
    };
  }
  log.info(`Found ${totalSrtFiles} total SRT files to evaluate for indexing.`);

  let srtFilesProcessedCount = 0;
  let lastCommitSrtPercentage = 0;
  let timeLimitReached = false;
  let newEntriesAddedInThisRun = 0;
  const forceReprocessAllSrtJson = event.forceReprocessAll === true;

  if (forceReprocessAllSrtJson) {
    log.info("forceReprocessAll is true: All SRT files will have their search entry JSONs regenerated.");
  }

  for (const srtFileKey of srtFilesToEvaluate) {
    if (Date.now() - lambdaStartTime >= PROCESSING_TIME_LIMIT_MS) {
      log.warn(`Time limit approaching (${PROCESSING_TIME_LIMIT_MINUTES} minutes). Stopping processing for this run.`);
      timeLimitReached = true;
      break;
    }

    log.debug(`Evaluating SRT file: ${srtFileKey} (${srtFilesProcessedCount + 1}/${totalSrtFiles})`);

    const srtFileName = path.basename(srtFileKey, '.srt');
    const podcastName = path.basename(path.dirname(srtFileKey));
    const searchEntriesKey = path.join(SEARCH_ENTRIES_DIR_PREFIX, podcastName, `${srtFileName}.json`);
    
    let searchEntriesForFile: SearchEntry[] = [];
    let jsonNeedsProcessing = true; // Assume we need to process (load or create) the JSON

    if (!forceReprocessAllSrtJson) {
        const existingJsonPath = await searchEntriesJsonFileExists(srtFileKey);
        if (existingJsonPath) {
            log.debug(`Search entries JSON already exists for ${srtFileKey} at ${existingJsonPath}. Loading it.`);
            try {
                const fileBuffer = await getFile(existingJsonPath);
                const fileContent = fileBuffer.toString('utf-8');
                const parsedEntries = JSON.parse(fileContent);
                if (Array.isArray(parsedEntries)) {
                    searchEntriesForFile = parsedEntries.map(entry => ({ ...entry }));
                    jsonNeedsProcessing = false; // Successfully loaded
                } else {
                    log.warn(`Unexpected format in ${existingJsonPath}, expected array. Will attempt to regenerate.`);
                }
            } catch (error: any) {
                log.error(`Error loading or parsing existing JSON ${existingJsonPath}: ${error.message}. Will attempt to regenerate.`);
            }
        }
    }

    if (jsonNeedsProcessing) { // True if forceReprocessAllSrtJson, or if JSON didn't exist, or if loading failed
        if (forceReprocessAllSrtJson) {
            log.debug(`forceReprocessAll: Regenerating search entries for ${srtFileKey}.`);
        } else {
            log.debug(`Search entries JSON does not exist or failed to load for ${srtFileKey}. Generating and saving it now.`);
        }
        try {
            searchEntriesForFile = await processSrtFile(srtFileKey); // This creates and saves the JSON.
        } catch (error: any) {
            log.error(`Failed to process SRT file ${srtFileKey} into search entries: ${error.message}`, error);
            srtFilesProcessedCount++; // Count as processed to avoid getting stuck on problematic files in loops
            continue; // Skip to next file
        }
    }
    
    if (searchEntriesForFile.length === 0) {
        log.debug(`No search entries found or generated for ${srtFileKey}. Moving to next file.`);
        srtFilesProcessedCount++;
        continue;
    }

    let entriesAddedForThisFile = 0;
    for (const entry of searchEntriesForFile) {
      // Ensure entry has an id, critical for FlexSearch
      if (typeof entry.id === 'undefined' || entry.id === null) {
        log.warn(`Search entry from ${srtFileKey} is missing an ID. Title: "${entry.episodeTitle}", Text snippet: "${entry.text.substring(0,50)}". Skipping this entry.`);
        continue;
      }
      const existingEntry = await index.get(entry.id);
      if (existingEntry) {
        log.debug(`Entry ${entry.id} already exists in index, skipping.`);
      } else {
        await index.add(entry);
        entriesAddedForThisFile++;
        newEntriesAddedInThisRun++;
      }
    }

    if (entriesAddedForThisFile > 0) {
        log.debug(`Added ${entriesAddedForThisFile} new entries to index from ${srtFileKey}`);
    } else {
        log.debug(`No new entries added to index from ${srtFileKey} (all likely existed or file had no entries).`);
    }

    srtFilesProcessedCount++;

    const currentSrtPercentage = Math.floor((srtFilesProcessedCount / totalSrtFiles) * 100);
    if (currentSrtPercentage >= lastCommitSrtPercentage + COMMIT_PERCENTAGE_THRESHOLD && totalSrtFiles > 0) {
      const elapsedTimeSinceStart = ((Date.now() - lambdaStartTime) / 1000).toFixed(2);
      log.info(
        `\n🔄 Progress: ${currentSrtPercentage}% of SRT files processed (${srtFilesProcessedCount}/${totalSrtFiles}).` + 
        `\nElapsed time: ${elapsedTimeSinceStart}s.` + 
        `\nCommitting index to DB...\n`
      );
      const commitStart = Date.now();
      await index.commit(); // Commit to SQLite
      log.info(`Committed index to DB in ${((Date.now() - commitStart) / 1000).toFixed(2)}s`);
      lastCommitSrtPercentage = Math.floor(currentSrtPercentage / COMMIT_PERCENTAGE_THRESHOLD) * COMMIT_PERCENTAGE_THRESHOLD;
    }
  }

  log.info('Finished processing loop. Committing final index changes to local SQLite DB.');
  const finalCommitStart = Date.now();
  await index.commit();
  log.info(`Final index commit took ${((Date.now() - finalCommitStart) / 1000).toFixed(2)}s.`);

  await logRowCountsForSQLiteTables(sqlite3DB);

  // TODO: If we've hit the time limit, we should save the index to the file that we currently do.

  log.info(`Uploading SQLite DB from ${LOCAL_DB_PATH} to S3 at ${SEARCH_INDEX_DB_S3_KEY}...`);
  try {
    const dbFileBuffer = await fs.readFile(LOCAL_DB_PATH);
    await saveFile(SEARCH_INDEX_DB_S3_KEY, dbFileBuffer);
    log.info(`FlexSearch index successfully saved as SQLite DB and exported to S3: ${SEARCH_INDEX_DB_S3_KEY}`);
  } catch (error: any) {
    log.error(`Failed to upload SQLite DB to S3: ${error.message}. The local DB may be present at ${LOCAL_DB_PATH} but S3 is not updated.`, error);
    // If S3 upload fails, this is a significant issue for the next run.
    // We might still re-trigger if timeLimitReached, but the next run might not get the latest state.
  }

  let retriggered = false;
  if (timeLimitReached && srtFilesProcessedCount < totalSrtFiles) {
    log.warn(`Lambda stopped early due to time limit. ${srtFilesProcessedCount}/${totalSrtFiles} SRT files evaluated. ${newEntriesAddedInThisRun} new entries added in this run.`);
    const nextRunCount = currentRunCount + 1;
    // Check MAX_RETRIGGER_COUNT again here, although checked at the start, to be absolutely sure before invoking.
    if (nextRunCount <= MAX_RETRIGGER_COUNT) {
      log.info(`Attempting to re-trigger Lambda for run #${nextRunCount} of ${MAX_RETRIGGER_COUNT}.`);
      try {
        const lambdaClient = new Lambda({});
        const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
        const functionVersion = process.env.AWS_LAMBDA_FUNCTION_VERSION;

        if (!functionName) {
            log.error("AWS_LAMBDA_FUNCTION_NAME environment variable not set. Cannot re-trigger.");
        } else {
            await lambdaClient.invoke({
              FunctionName: functionName,
              Qualifier: functionVersion, // Invoke the same version
              InvocationType: 'Event', // Asynchronous invocation
              Payload: JSON.stringify({ previousRunsCount: nextRunCount, forceReprocessAll: event.forceReprocessAll }), // Persist forceReprocessAll
            });
            log.info(`Successfully re-triggered Lambda. Next run count: ${nextRunCount}.`);
            retriggered = true;
        }
      } catch (error: any) {
        log.error(`Failed to re-trigger Lambda: ${error.message}`, error);
      }
    } else {
      log.error(`Max re-trigger count (${MAX_RETRIGGER_COUNT}) reached. Will not re-trigger again. Indexing may be incomplete for ${totalSrtFiles - srtFilesProcessedCount} files.`);
    }
  } else {
    if (timeLimitReached && srtFilesProcessedCount >= totalSrtFiles) {
        log.info('Time limit was reached, but all SRT files were evaluated. Indexing complete for this cycle.');
    } else if (!timeLimitReached) {
        log.info(`All ${totalSrtFiles} SRT files evaluated within the time limit. Indexing complete. ${newEntriesAddedInThisRun} new entries added in this run.`);
    }
  }

  try {
    await fs.unlink(LOCAL_DB_PATH);
    log.info(`Cleaned up local SQLite DB file: ${LOCAL_DB_PATH}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') { // ENOENT means file not found, which is fine
      log.warn(`Could not clean up local SQLite DB file: ${error.message}`);
    }
  }

  const totalLambdaTime = (Date.now() - lambdaStartTime) / 1000;
  const statusMessage = timeLimitReached ? 
    (retriggered ? "Stopped early, re-triggered." : (srtFilesProcessedCount < totalSrtFiles ? "Stopped early, max retriggers reached or failed to retrigger." : "Completed at time limit."))
    : "Completed successfully.";

  log.info('\n📊 SRT Processing Summary:');
  log.info(`\n⏱️  Total Duration: ${totalLambdaTime.toFixed(2)} seconds`);
  log.info(`\n📁 Total SRT Files Found: ${totalSrtFiles}`);
  log.info(`✅ Successfully Processed: ${srtFilesProcessedCount}`);
  log.info(`📝 New Search Entries Added: ${newEntriesAddedInThisRun}`);
  
  if (timeLimitReached) {
    log.info(`\n⚠️  Time Limit Reached: ${PROCESSING_TIME_LIMIT_MINUTES} minutes`);
    if (retriggered) {
      log.info(`🔄 Lambda Re-triggered: Run #${currentRunCount + 1} of ${MAX_RETRIGGER_COUNT}`);
    } else if (srtFilesProcessedCount < totalSrtFiles) {
      log.info(`❌ Max Re-triggers Reached: ${totalSrtFiles - srtFilesProcessedCount} files remaining`);
    }
  }

  log.info(`\n✨ ${statusMessage}`);

  return {
    status: timeLimitReached && srtFilesProcessedCount < totalSrtFiles && !retriggered ? 'error_incomplete' : 'success',
    message: statusMessage,
    evaluatedSrtFiles: srtFilesProcessedCount,
    totalSrtFiles: totalSrtFiles,
    newEntriesAdded: newEntriesAddedInThisRun,
    timeLimitReached,
    retriggered,
    currentRunCount: currentRunCount + 1 // next run would be this +1
  };
}

// If running directly (ESM compatible approach)
// In ESM, import.meta.url will be defined and can be compared to process.argv[1]
const scriptPath = path.resolve(process.argv[1]);
// Check if the module is being run directly
if (import.meta.url === `file://${scriptPath}`) {
  // Example: Pass { forceReprocessAll: true } to reprocess all JSONs and re-index everything
  // Or { previousRunsCount: N } to simulate a re-triggered run
  handler({ forceReprocessAll: false }) 
    .then(result => {
      log.debug('Local run completed with result:');
      console.dir(result, { depth: null });
    })
    .catch(err => {
      log.error('Local run failed with error:');
      console.error(err);
    });
}