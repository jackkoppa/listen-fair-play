import * as path from 'path';
import SrtParser from 'srt-parser-2';
import fs from 'fs-extra'; // Still needed for stream operations with ffmpeg
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { log } from '@listen-fair-play/logging';
import {
  fileExists,
  getFile,
  saveFile,
  listFiles,
  createDirectory,
  getDirectorySize,
  listDirectories,
} from '@listen-fair-play/s3'
import { transcribeViaWhisper, WhisperApiProvider } from './utils/transcribe-via-whisper.js';
import { splitAudioFile, prepareAudioFile, TranscriptionChunk } from './utils/ffmpeg-utils.js';
import { 
  applyCorrectionToFile,
  aggregateCorrectionResults,
  type ApplyCorrectionsResult
} from './utils/apply-spelling-corrections.js';

log.info(`▶️ Starting process-new-audio-files-via-whisper, with logging level: ${log.getLevel()}`);

// Constants - S3 paths
const AUDIO_DIR_PREFIX = 'audio/';
const TRANSCRIPTS_DIR_PREFIX = 'transcripts/';
const MAX_FILE_SIZE_MB = 25;
const CHUNK_DURATION_MINUTES = 10; // Approximate chunk size to stay under 25MB
// Which Whisper API provider to use (can be configured via environment variable)
const WHISPER_API_PROVIDER: WhisperApiProvider = (process.env.WHISPER_API_PROVIDER as WhisperApiProvider) || 'openai';
const LAMBDA_CLIENT = new LambdaClient({});
const INDEXING_LAMBDA_NAME = 'convert-srt-files-into-indexed-search-entries';

// Helper function to detect if we're running in AWS Lambda environment
function isRunningInLambda(): boolean {
  return !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

// Types
interface SrtEntry {
  id: string;
  startTime: string;
  endTime: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

// Helper function to get all MP3 files in a directory
async function getMp3Files(dirKey: string): Promise<string[]> {
  const files = await listFiles(dirKey);
  return files.filter(file => file.endsWith('.mp3') && !file.endsWith('.DS_Store'));
}

// Helper function to check if transcription exists
async function transcriptExists(fileKey: string): Promise<boolean> {
  const audioFileName = path.basename(fileKey, '.mp3');
  const podcastName = path.basename(path.dirname(fileKey));
  const transcriptKey = path.join(TRANSCRIPTS_DIR_PREFIX, podcastName, `${audioFileName}.srt`);

  return fileExists(transcriptKey.normalize('NFC'));
}

// Helper function to get the file size in MB
async function getFileSizeMB(fileKey: string): Promise<number> {
  // Download the file to check its size
  const buffer = await getFile(fileKey);
  return buffer.length / (1024 * 1024);
}

// Helper function to combine SRT files
function combineSrtFiles(srtFiles: string[]): string {
  const parser = new SrtParser();
  let combinedEntries: SrtEntry[] = [];
  let currentId = 1;

  srtFiles.forEach((srtContent, index) => {
    try {
      const entries = parser.fromSrt(srtContent);
      const offset = index * CHUNK_DURATION_MINUTES * 60;

      entries.forEach((entry: any) => {
        // Skip entries with invalid timestamps (sometimes Whisper can return these)
        if (!entry.startTime || !entry.endTime ||
          entry.startTime.includes('NaN') || entry.endTime.includes('NaN')) {
          log.debug(`Skipping entry with invalid timestamp: ${JSON.stringify(entry)}`);
          return;
        }

        // Calculate seconds if not already present
        if (typeof entry.startSeconds !== 'number' || isNaN(entry.startSeconds)) {
          entry.startSeconds = timeStringToSeconds(entry.startTime);
        }

        if (typeof entry.endSeconds !== 'number' || isNaN(entry.endSeconds)) {
          entry.endSeconds = timeStringToSeconds(entry.endTime);
        }

        // Convert entry to our SrtEntry format with valid seconds
        const newEntry: SrtEntry = {
          id: currentId.toString(),
          startTime: adjustTimestamp(entry.startTime, offset),
          endTime: adjustTimestamp(entry.endTime, offset),
          text: entry.text,
          startSeconds: entry.startSeconds + offset,
          endSeconds: entry.endSeconds + offset
        };
        currentId++;
        combinedEntries.push(newEntry);
      });
    } catch (error) {
      log.error(`Error parsing SRT content for chunk ${index}:`, error);
    }
  });

  // Ensure entries are sorted by time
  combinedEntries.sort((a, b) => a.startSeconds - b.startSeconds);

  return parser.toSrt(combinedEntries);
}

// Helper function to convert SRT timestamp to seconds
function timeStringToSeconds(timeString: string): number {
  // Handle format like "00:00:00,000"
  const parts = timeString.split(',');
  const [hours, minutes, seconds] = (parts[0] || '00:00:00').split(':').map(part => {
    const num = Number(part);
    return isNaN(num) ? 0 : num;
  });

  return hours * 3600 + minutes * 60 + seconds;
}

// Helper function to adjust SRT timestamps
function adjustTimestamp(timestamp: string, offsetSeconds: number): string {
  // Handle timestamp format like "00:00:00,000"
  const parts = timestamp.split(',');
  const milliseconds = parts[1] || '000';

  // Parse time components
  const [hours, minutes, seconds] = (parts[0] || '00:00:00').split(':').map(part => {
    // Ensure we're dealing with valid numbers
    const num = Number(part);
    return isNaN(num) ? 0 : num;
  });

  // Calculate total seconds with offset
  const totalSeconds = hours * 3600 + minutes * 60 + seconds + offsetSeconds;

  // Format new timestamp
  const newHours = Math.floor(totalSeconds / 3600);
  const newMinutes = Math.floor((totalSeconds % 3600) / 60);
  const newSeconds = Math.floor(totalSeconds % 60);

  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')},${milliseconds}`;
}

// Helper function to process a single audio file
async function processAudioFile(fileKey: string): Promise<ApplyCorrectionsResult | null> {
  const podcastName = path.basename(path.dirname(fileKey));
  const transcriptDirKey = path.join(TRANSCRIPTS_DIR_PREFIX, podcastName);
  const audioFileName = path.basename(fileKey, '.mp3');

  // Clean up any existing temporary chunks for this podcast to avoid ffmpeg conflicts
  const tempPodcastDir = path.join('/tmp/audio', podcastName);
  if (await fs.pathExists(tempPodcastDir)) {
    log.debug(`Cleaning up existing temporary directory: ${tempPodcastDir}`);
    await fs.remove(tempPodcastDir);
  }

  // Ensure transcript directory exists
  await createDirectory(transcriptDirKey);

  // Check if transcription already exists
  const transcriptKey = path.join(transcriptDirKey, `${audioFileName}.srt`);
  if (await transcriptExists(fileKey)) {
    log.debug(`Transcript already exists for ${fileKey}, skipping`);
    return null;
  }

  // Get file size
  const fileSizeMB = await getFileSizeMB(fileKey);

  let chunks: TranscriptionChunk[] = [];
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    log.info(`File ${fileKey} is too large (${fileSizeMB.toFixed(2)}MB). Splitting into chunks...`);
    chunks = await splitAudioFile(fileKey);
  } else {
    // For small files, prepare them for processing
    const { filePath } = await prepareAudioFile(fileKey);

    chunks = [{
      startTime: 0,
      endTime: 0, // Will be determined by ffprobe
      filePath: filePath
    }];
  }

  // Transcribe each chunk
  const srtChunks: string[] = [];
  for (const chunk of chunks) {
    log.info(`Transcribing chunk: ${chunk.filePath}`);
    const srtContent = await transcribeViaWhisper({
      filePath: chunk.filePath,
      whisperApiProvider: WHISPER_API_PROVIDER,
      responseFormat: 'srt'
    });
    srtChunks.push(srtContent);
    // Clean up the individual chunk file
    await fs.remove(chunk.filePath);
    log.info(`Transcription complete for chunk: ${chunk.filePath}. SRT saved.`);
  }

  // Combine SRT files
  const finalSrt = chunks.length > 1 ? combineSrtFiles(srtChunks) : srtChunks[0];

  // TODO: Remove this logging after debugging
  log.info(`Combined SRT files: ${srtChunks.length}`);

  // Save the combined SRT file to S3
  await saveFile(transcriptKey, Buffer.from(finalSrt));

  log.info(
    `\n✅ Transcription complete for ${fileKey}.` +
    `\n💾 SRT saved to ${transcriptKey}\n`
  );

  // Clean up the temporary directory (original file and its parent directory in /tmp)
  const tempBaseDir = path.join('/tmp', path.dirname(fileKey).split(path.sep)[0]);
  if (await fs.pathExists(tempBaseDir)) {
    await fs.remove(tempBaseDir);
    log.debug(`Cleaned up temporary directory: ${tempBaseDir}`);
  }

  // Apply spelling corrections
  const s3FileOperations = {
    getFileContent: async (filePath: string): Promise<string> => {
      const buffer = await getFile(filePath);
      return buffer.toString('utf-8');
    },
    saveFileContent: async (filePath: string, content: string): Promise<void> => {
      await saveFile(filePath, Buffer.from(content, 'utf-8'));
    }
  };

  const correctionResult = await applyCorrectionToFile(
    transcriptKey,
    s3FileOperations.getFileContent,
    s3FileOperations.saveFileContent
  );

  if (correctionResult.totalCorrections > 0) {
    log.debug(`Applied ${correctionResult.totalCorrections} spelling corrections to ${transcriptKey}`);
  }

  return correctionResult;
}

/**
 * Main Lambda handler function.
 * This function processes new audio files by transcribing them using Whisper.
 * 
 * When running, we'll scan S3 for all audio files in the `audio/` directory, and process any new ones.
 */
export async function handler(): Promise<void> {
  log.info(`🟢 Starting process-new-audio-files-via-whisper > handler, with logging level: ${log.getLevel()}`);
  const lambdaStartTime = Date.now();
  log.info('⏱️ Starting at', new Date().toISOString());
  log.info(`🤫  Whisper API Provider: ${WHISPER_API_PROVIDER}`);

  let newTranscriptsCreated = false;

  const stats = {
    totalFiles: 0,
    skippedFiles: 0,
    processedFiles: 0,
    podcastStats: new Map<string, { total: number; skipped: number; processed: number; sizeBytes: number }>()
  };

  let filesToProcess: string[] = [];
  const spellingCorrectionResults: ApplyCorrectionsResult[] = [];

  log.info('Scanning S3 for audio files.');
  const allPodcastDirs = await listDirectories(AUDIO_DIR_PREFIX);
  log.info(`Found podcast directories: ${allPodcastDirs.join(', ')}`);

  // Process each podcast directory
  for (const podcastDir of allPodcastDirs) {
    log.info(`Processing podcast directory: ${podcastDir}`);

    if (!podcastDir || podcastDir.endsWith('.DS_Store')) continue; // Skip empty, undefined, or .DS_Store directories

    // Get all MP3 files in this podcast directory
    const mp3Files = await getMp3Files(podcastDir);
    filesToProcess.push(...mp3Files);

    // Get total size for this podcast directory
    const podcastName = path.basename(podcastDir);
    const dirSize = await getDirectorySize(podcastDir);

    // Initialize podcast stats
    stats.podcastStats.set(podcastName, {
      total: mp3Files.length,
      skipped: 0,
      processed: 0,
      sizeBytes: dirSize
    });

    stats.totalFiles += mp3Files.length;

    // TODO: Remove this logging after debugging
    log.info(`Found ${mp3Files.length} MP3 files to process in ${podcastDir}`);
  }
  log.info(`Found ${filesToProcess.length} MP3 files to process across all directories.`);

  if (filesToProcess.length === 0) {
    log.info("No audio files found to process.");
    return;
  }

  for (const fileKey of filesToProcess) {
    try {
      log.debug(`Processing file: ${fileKey}`);
      const podcastName = path.basename(path.dirname(fileKey));

      // Check if transcription exists
      if (await transcriptExists(fileKey)) {
        stats.skippedFiles++;
        stats.podcastStats.get(podcastName)!.skipped++;
        log.debug(`Transcript already exists for ${fileKey}, skipping`);
        continue;
      }

      const correctionResult = await processAudioFile(fileKey);
      stats.processedFiles++;
      stats.podcastStats.get(podcastName)!.processed++;
      newTranscriptsCreated = true;
      
      // Collect spelling correction results
      if (correctionResult) {
        spellingCorrectionResults.push(correctionResult);
      }
    } catch (error) {
      log.error(`Error processing file ${fileKey}:`, error);
      // Continue with next file even if one fails (original behavior)
    }
  }

  const totalLambdaTime = (Date.now() - lambdaStartTime) / 1000; // Convert to seconds

  // Log summary with emojis and formatting
  log.info('\n📊 Transcription Process Summary:');
  log.info(`\n⏱️  Total Duration: ${totalLambdaTime.toFixed(2)} seconds`);
  log.info(`\n📁 Total Files Found: ${stats.totalFiles}`);
  log.info(`✅ Successfully Processed: ${stats.processedFiles}`);
  log.info(`⏭️  Skipped (Already Transcribed): ${stats.skippedFiles}`);

  log.info('\n📂 Breakdown by Podcast:');
  for (const [podcast, podcastStats] of stats.podcastStats) {
    const podcastSizeMB = podcastStats.sizeBytes / (1024 * 1024);
    const podcastSizeDisplay = podcastSizeMB >= 1024
      ? `${(podcastSizeMB / 1024).toFixed(2)} GB`
      : `${podcastSizeMB.toFixed(2)} MB`;

    log.info(`\n🎙️  ${podcast}:`);
    log.info(`   📁 Total Files: ${podcastStats.total}`);
    log.info(`   📦 Total Size: ${podcastSizeDisplay}`);
    log.info(`   ✅ Processed: ${podcastStats.processed}`);
    log.info(`   ⏭️  Skipped: ${podcastStats.skipped}`);
  }

  // Log spelling corrections summary
  if (spellingCorrectionResults.length > 0) {
    const aggregatedCorrections = aggregateCorrectionResults(spellingCorrectionResults);
    const totalCorrections = aggregatedCorrections.reduce((sum, result) => sum + result.correctionsApplied, 0);

    if (totalCorrections > 0) {
      log.info('\n🔤 Spelling Corrections Applied:');
      log.info(`📝 Total Corrections: ${totalCorrections}`);
      aggregatedCorrections
        .sort((a, b) => b.correctionsApplied - a.correctionsApplied)
        .forEach(result => {
          log.info(`   "${result.correctedSpelling}": ${result.correctionsApplied} corrections`);
        });
    }
  }

  log.info('\n✨ Transcription process finished.');

  // If new transcripts were created, invoke the indexing Lambda (only when running in AWS Lambda)
  if (newTranscriptsCreated) {
    if (isRunningInLambda()) {
      log.info(`New transcripts were created. Invoking ${INDEXING_LAMBDA_NAME}...`);
      try {
        const command = new InvokeCommand({
          FunctionName: INDEXING_LAMBDA_NAME,
          InvocationType: 'Event', // Asynchronous invocation
        });
        await LAMBDA_CLIENT.send(command);
        log.info(`${INDEXING_LAMBDA_NAME} invoked successfully.`);
      } catch (error) {
        log.error(`Error invoking ${INDEXING_LAMBDA_NAME}:`, error);
      }
    } else {
      log.info(`New transcripts were created, but skipping ${INDEXING_LAMBDA_NAME} invocation (running locally).`);
    }
  } else {
    log.info('No new transcripts were created. Indexing Lambda will not be invoked.');
  }
}

// Run the handler if this file is executed directly
// In ES modules, this is the standard way to detect if a file is being run directly
const scriptPath = path.resolve(process.argv[1]);
if (import.meta.url === `file://${scriptPath}`) {
  log.info('Starting audio processing via Whisper directly...');
  handler()
    .then(() => log.info('Processing completed successfully (direct run)'))
    .catch(error => {
      log.error('Processing failed (direct run):', error);
      process.exit(1);
    });
}
