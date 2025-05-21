import * as path from 'path';
import * as fs from 'fs/promises';
import sqlite3 from "sqlite3";
import { SEARCH_INDEX_DB_S3_KEY, LOCAL_DB_PATH, EPISODE_MANIFEST_KEY } from '@listen-fair-play/constants';
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

log.info(`▶️ Starting convert-srt-files-into-indexed-search-entries, with logging level: ${log.getLevel()}`);

// Constants - S3 paths
const TRANSCRIPTS_DIR_PREFIX = 'transcripts/';
const SEARCH_ENTRIES_DIR_PREFIX = 'search-entries/';

// Configurable constants as per requirements
const PROCESSING_TIME_LIMIT_MINUTES = 7; 
// Give a 30-second buffer before the planned AWS Lambda timeout (currently limiting to 7 minutes above, Lambda max is 15 minutes)
const PROCESSING_TIME_LIMIT_MS = (PROCESSING_TIME_LIMIT_MINUTES * 60 * 1000) - (30 * 1000); 
const MAX_RETRIGGER_COUNT = 5; 
const COMMIT_PERCENTAGE_THRESHOLD = 5; // Commit every 5% of SRT files processed

// Structure for episode data from the manifest
interface EpisodeManifestEntry {
  sequentialId: number;
  fileKey: string;
  // other fields from manifest are not strictly needed here but could be added
}

let episodeManifestData: EpisodeManifestEntry[] = [];

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
  // This logic might need adjustment if "existence" is purely based on the manifest now
  // For now, keeping it as is, assuming JSON files are still the intermediate step for generated entries.
  const filesToProcess: string[] = [];
  
  for (const srtFile of srtFiles) {
    const hasSearchEntries = await searchEntriesExist(srtFile);
    if (!hasSearchEntries) {
      filesToProcess.push(srtFile);
    }
  }
  
  return filesToProcess;
}

// Function to process a single SRT file
async function processSrtFile(srtFileKey: string): Promise<SearchEntry[]> {
  log.debug(`Processing SRT file: ${srtFileKey}`);
  
  // Get the SRT file content
  const srtBuffer = await getFile(srtFileKey);
  const srtContent = srtBuffer.toString('utf-8');
  
  // Derive fileKey to match manifest (e.g., "2020-01-23_The-Transfer-Window")
  const baseSrtName = path.basename(srtFileKey, '.srt'); // e.g., YYYY-MM-DD_episode-title

  const manifestEntry = episodeManifestData.find(ep => ep.fileKey === baseSrtName);

  if (!manifestEntry) {
    log.error(`No manifest entry found for SRT file key: ${srtFileKey} (derived fileKey: ${baseSrtName}). Skipping this file.`);
    return [];
  }
  const sequentialEpisodeId = manifestEntry.sequentialId;
  
  // Convert SRT content to search entries using the utility function
  // Note: convertSrtFileIntoSearchEntryArray will need its signature updated too.
  const utilityEntries = convertSrtFileIntoSearchEntryArray({
    srtFileContent: srtContent,
    sequentialEpisodeId
  });
  
  // Convert entries to our SearchEntry type and add the new ID structure
  const searchEntries: SearchEntry[] = utilityEntries; // Simplified from map as utilityEntries are already complete
  
  log.debug(`Generated ${searchEntries.length} search entries from SRT file ${srtFileKey}`);
  
  // Save search entries to S3
  const srtFileName = path.basename(srtFileKey, '.srt');
  const podcastName = path.basename(path.dirname(srtFileKey)); // This might be simplified if manifest gives full path or structure
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

// CURSOR-TODO: Let's add the work of fetching the sqliteDB file from S3, to a local temp file, to a function here
// And then let's call it *before* the handler, in the init phase,
// So that it's available if multiple runs are made (so we don't have to re-download the file every time from S3)

// Main handler function
export async function handler(event: { previousRunsCount?: number; forceReprocessAll?: boolean } = {}): Promise<any> {
  log.info(`🟢 Starting convert-srt-files-into-indexed-search-entries > handler, with logging level: ${log.getLevel()}`);
  const lambdaStartTime = Date.now();
  log.info('⏱️ Starting at', new Date().toISOString())
  log.info('�� Event:', event)

  try {
    log.info(`Fetching episode manifest from S3: ${EPISODE_MANIFEST_KEY}`);
    const manifestBuffer = await getFile(EPISODE_MANIFEST_KEY);
    const manifestContent = manifestBuffer.toString('utf-8');
    const parsedManifest = JSON.parse(manifestContent);
    if (parsedManifest && Array.isArray(parsedManifest.episodes)) {
      episodeManifestData = parsedManifest.episodes.map((ep: any) => ({ // Cast to any for now, can be stricter with full Episode type
        sequentialId: ep.sequentialId,
        fileKey: ep.fileKey,
      }));
      log.info(`Successfully loaded and parsed ${episodeManifestData.length} episodes from manifest.`);
    } else {
      log.error('Episode manifest is not in the expected format (missing episodes array). Cannot proceed with new ID logic.');
      // Depending on strictness, might want to throw an error or return an error state
      episodeManifestData = []; // Ensure it's empty to prevent partial processing
      // Potentially throw new Error("Invalid episode manifest format.");
    }
  } catch (error: any) {
    log.error(`Failed to load or parse episode manifest from ${EPISODE_MANIFEST_KEY}: ${error.message}`, error);
    log.error('Cannot proceed without episode manifest for new ID logic. Aborting.');
    return {
      status: 'error',
      message: `Failed to load episode manifest: ${error.message}`,
      evaluatedSrtFiles: 0,
      totalSrtFiles: 0,
      newEntriesAdded: 0,
      timeLimitReached: false,
      retriggered: false,
    };
  }

  if (episodeManifestData.length === 0) {
      log.warn("Episode manifest data is empty after loading. This may lead to no SRTs being processed correctly if they rely on manifest IDs. Continuing, but this is unusual.");
  }

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

  // Step 1: List the "podcast directories" under the main transcripts prefix
  const podcastDirectoryPrefixes = await listFiles(TRANSCRIPTS_DIR_PREFIX);
  log.info(`[DEBUG] listFiles('${TRANSCRIPTS_DIR_PREFIX}') returned ${podcastDirectoryPrefixes.length} potential podcast directory prefixes.`);
  if (podcastDirectoryPrefixes.length > 0) {
    log.debug(`[DEBUG] Podcast directory prefixes: ${JSON.stringify(podcastDirectoryPrefixes)}`);
  }

  let allSrtFiles: string[] = [];

  // Step 2: For each podcast directory prefix, list the files within it
  for (const dirPrefix of podcastDirectoryPrefixes) {
    // Ensure the prefix ends with a '/' for S3 listing, if it doesn't already
    const currentPodcastPrefix = dirPrefix.endsWith('/') ? dirPrefix : `${dirPrefix}/`;
    log.debug(`[DEBUG] Listing files under podcast prefix: ${currentPodcastPrefix}`);
    const filesInDir = await listFiles(currentPodcastPrefix);
    log.debug(`[DEBUG] Found ${filesInDir.length} items under ${currentPodcastPrefix}.`);
    if (filesInDir.length > 0 && filesInDir.length < 10) {
        log.debug(`[DEBUG] Items: ${JSON.stringify(filesInDir)}`)
    } else if (filesInDir.length > 0) {
        log.debug(`[DEBUG] First 5 items: ${JSON.stringify(filesInDir.slice(0,5))}`)
    }

    const srtFilesInCurrentDir = filesInDir.filter(file => {
      if (typeof file !== 'string') {
        log.warn(`[DEBUG] Encountered non-string item in listFiles output for ${currentPodcastPrefix}: ${JSON.stringify(file)}`);
        return false;
      }
      return file.endsWith('.srt');
    });
    log.debug(`[DEBUG] Found ${srtFilesInCurrentDir.length} SRT files in ${currentPodcastPrefix}.`);
    allSrtFiles.push(...srtFilesInCurrentDir);
  }
  
  log.info(`[DEBUG] Total SRT files found across all podcast directories: ${allSrtFiles.length}`);
  if (allSrtFiles.length > 0) {
    log.debug(`[DEBUG] First 5 SRT files from combined list: ${JSON.stringify(allSrtFiles.slice(0,5))}`);
  }

  const srtFilesToEvaluate = allSrtFiles; // Already filtered for .srt
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
      if (typeof entry.id === 'undefined' || entry.id === null || entry.id === '') {
        log.warn(`Search entry from ${srtFileKey} is missing an ID or ID is empty. Text snippet: "${entry.text.substring(0,50)}". Skipping this entry.`);
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