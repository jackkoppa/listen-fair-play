import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import SrtParser from 'srt-parser-2';
import fs from 'fs-extra'; // Still needed for stream operations with ffmpeg
import { log } from '@listen-fair-play/logging';
import {
  fileExists,
  getFile,
  saveFile,
  listFiles,
  createDirectory,
} from '@listen-fair-play/s3'
import { transcribeViaWhisper, WhisperApiProvider } from '../utils/whisper/transcribe-via-whisper.js';

// Constants - S3 paths
const AUDIO_DIR_PREFIX = 'audio/';
const TRANSCRIPTS_DIR_PREFIX = 'transcripts/';
const MAX_FILE_SIZE_MB = 25;
const CHUNK_DURATION_MINUTES = 10; // Approximate chunk size to stay under 25MB
// Which Whisper API provider to use (can be configured via environment variable)
const WHISPER_API_PROVIDER: WhisperApiProvider = (process.env.WHISPER_API_PROVIDER as WhisperApiProvider) || 'openai';

// Initialize loglevel
const loggingLevel = process.env.LOGGING_LEVEL || 'warn';
log.setLevel(loggingLevel as log.LogLevelDesc);

// Types
interface TranscriptionChunk {
  startTime: number;
  endTime: number;
  filePath: string;
}

interface SrtEntry {
  id: string;
  startTime: string;
  endTime: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

interface FfprobeMetadata {
  format: {
    duration?: number;
  };
}

// Helper function to get all MP3 files in a directory
async function getMp3Files(dirKey: string): Promise<string[]> {
  const files = await listFiles(dirKey);
  return files.filter(file => file.endsWith('.mp3'));
}

// Helper function to check if transcription exists
async function transcriptExists(fileKey: string): Promise<boolean> {
  const audioFileName = path.basename(fileKey, '.mp3');
  const podcastName = path.basename(path.dirname(fileKey));
  const transcriptKey = path.join(TRANSCRIPTS_DIR_PREFIX, podcastName, `${audioFileName}.srt`);

  return fileExists(transcriptKey);
}

// Helper function to split audio file into chunks
async function splitAudioFile(fileKey: string): Promise<TranscriptionChunk[]> {
  // For ffmpeg to work, we need to download the file to a temporary location
  const tempDir = path.join('/tmp', path.dirname(fileKey));
  const tempFilePath = path.join('/tmp', fileKey);

  // Ensure the temp directory exists
  await fs.ensureDir(tempDir);

  // Download the file to the temp location
  const audioBuffer = await getFile(fileKey);
  await fs.writeFile(tempFilePath, audioBuffer);

  return new Promise((resolve, reject) => {
    const chunks: TranscriptionChunk[] = [];
    let currentStart = 0;

    ffmpeg.ffprobe(tempFilePath, async (err: Error | null, metadata: FfprobeMetadata) => {
      if (err) reject(err);

      const duration = metadata.format.duration || 0;
      const chunkDuration = CHUNK_DURATION_MINUTES * 60;

      const promises: Promise<void>[] = [];

      while (currentStart < duration) {
        const endTime = Math.min(currentStart + chunkDuration, duration);
        const chunkPath = `${tempFilePath}.part${chunks.length + 1}.mp3`;

        chunks.push({
          startTime: currentStart,
          endTime: endTime,
          filePath: chunkPath
        });

        // Actually create the chunk file using ffmpeg
        promises.push(new Promise<void>((resolveChunk, rejectChunk) => {
          ffmpeg(tempFilePath)
            .setStartTime(currentStart)
            .setDuration(endTime - currentStart)
            .output(chunkPath)
            .on('end', () => {
              log.debug(`Created chunk: ${chunkPath}`);
              resolveChunk();
            })
            .on('error', (err) => {
              log.error(`Error creating chunk ${chunkPath}:`, err);
              rejectChunk(err);
            })
            .run();
        }));

        currentStart = endTime;
      }

      try {
        await Promise.all(promises);
        resolve(chunks);
      } catch (error) {
        reject(error);
      }
    });
  });
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

// Helper function to get the file size in MB
async function getFileSizeMB(fileKey: string): Promise<number> {
  // Download the file to check its size
  const buffer = await getFile(fileKey);
  return buffer.length / (1024 * 1024);
}

// Helper function to process a single audio file
async function processAudioFile(fileKey: string): Promise<void> {
  const podcastName = path.basename(path.dirname(fileKey));
  const transcriptDirKey = path.join(TRANSCRIPTS_DIR_PREFIX, podcastName);
  const audioFileName = path.basename(fileKey, '.mp3');

  // Ensure transcript directory exists
  await createDirectory(transcriptDirKey);

  // Check if transcription already exists
  const transcriptKey = path.join(transcriptDirKey, `${audioFileName}.srt`);
  if (await transcriptExists(fileKey)) {
    log.debug(`Transcript already exists for ${fileKey}, skipping`);
    return;
  }

  // Get file size
  const fileSizeMB = await getFileSizeMB(fileKey);

  let chunks: TranscriptionChunk[] = [];
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    log.debug(`File ${fileKey} is too large (${fileSizeMB.toFixed(2)}MB). Splitting into chunks...`);
    chunks = await splitAudioFile(fileKey);
  } else {
    // For small files, we still need to download them to a temp location for ffmpeg
    const tempDir = path.join('/tmp', path.dirname(fileKey));
    const tempFilePath = path.join('/tmp', fileKey);

    // Ensure the temp directory exists
    await fs.ensureDir(tempDir);

    // Download the file to the temp location
    const audioBuffer = await getFile(fileKey);
    await fs.writeFile(tempFilePath, audioBuffer);

    chunks = [{
      startTime: 0,
      endTime: 0, // Will be determined by ffprobe
      filePath: tempFilePath
    }];
  }

  // Transcribe each chunk
  const srtChunks: string[] = [];
  for (const chunk of chunks) {
    log.debug(`Transcribing chunk: ${chunk.filePath}`);
    const srtContent = await transcribeViaWhisper({
      filePath: chunk.filePath,
      whisperApiProvider: WHISPER_API_PROVIDER,
      responseFormat: 'srt'
    });
    srtChunks.push(srtContent);
    // Clean up the individual chunk file
    await fs.remove(chunk.filePath);
    log.debug(`Transcription complete for chunk: ${chunk.filePath}. SRT saved.`);
  }

  // Combine SRT files
  const finalSrt = chunks.length > 1 ? combineSrtFiles(srtChunks) : srtChunks[0];

  // Save the combined SRT file to S3
  await saveFile(transcriptKey, Buffer.from(finalSrt));

  log.debug(`Transcription complete for ${fileKey}. SRT saved to ${transcriptKey}`);

  // Clean up the temporary directory (original file and its parent directory in /tmp)
  const tempBaseDir = path.join('/tmp', path.dirname(fileKey).split(path.sep)[0]);
  if (await fs.pathExists(tempBaseDir)) {
    await fs.remove(tempBaseDir);
    log.debug(`Cleaned up temporary directory: ${tempBaseDir}`);
  }
}

/**
 * Main Lambda handler function.
 * This function processes new audio files by transcribing them using Whisper.
 * It can be triggered by an S3 event or run manually with a list of audio files.
 * 
 * @param event - The event object, which can optionally contain a list of audio files to process.
 */
export async function handler(event: { audioFiles?: string[] } = {}): Promise<void> {
  log.debug('Starting transcription process...');
  log.debug(`Whisper API Provider: ${WHISPER_API_PROVIDER}`);

  let filesToProcess: string[] = [];

  if (event.audioFiles && event.audioFiles.length > 0) {
    filesToProcess = event.audioFiles;
    log.debug(`Processing specific audio files provided in event: ${filesToProcess.join(', ')}`);
  } else {
    // Fallback to original logic structure if event.audioFiles is not present
    // This part is a best guess reconstruction based on typical patterns
    log.debug('Scanning S3 for audio files as no specific files were provided in the event.');
    const allPodcastDirs = await listFiles(AUDIO_DIR_PREFIX);
    log.debug(`Found podcast directories: ${allPodcastDirs.join(', ')}`);
    for (const podcastDir of allPodcastDirs) {
      if (!podcastDir) continue; // Skip empty or undefined directory names
      const mp3Files = await getMp3Files(podcastDir); // podcastDir should be the full prefix like 'audio/podcast_name/'
      filesToProcess.push(...mp3Files);
    }
    log.debug(`Found ${filesToProcess.length} MP3 files to process across all directories.`);
  }

  if (filesToProcess.length === 0) {
    log.debug("No audio files found to process.");
    return;
  }

  for (const fileKey of filesToProcess) {
    try {
      log.debug(`Processing file: ${fileKey}`);
      await processAudioFile(fileKey);
    } catch (error) {
      log.error(`Error processing file ${fileKey}:`, error);
      // Continue with next file even if one fails (original behavior)
    }
  }
  log.debug('Transcription process finished.');
}

// Run the handler if this file is executed directly
// In ES modules, this is the standard way to detect if a file is being run directly
const scriptPath = path.resolve(process.argv[1]);
if (import.meta.url === `file://${scriptPath}`) {
  log.debug('Starting audio processing via Whisper directly...');
  handler()
    .then(() => log.debug('Processing completed successfully (direct run)'))
    .catch(error => {
      log.error('Processing failed (direct run):', error);
      process.exit(1);
    });
}
