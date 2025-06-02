import * as path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { log } from '@listen-fair-play/logging';
import { getFile } from '@listen-fair-play/s3';

// Constants
const CHUNK_DURATION_MINUTES = 10; // Approximate chunk size to stay under 25MB

// Types
export interface TranscriptionChunk {
  startTime: number;
  endTime: number;
  filePath: string;
}

export interface FfprobeMetadata {
  format: {
    duration?: number;
  };
}

/**
 * Get the appropriate binary paths for the current environment
 * In Lambda with layers, binaries are in /opt/bin/
 * In local development, they're in the system PATH
 */
function getBinaryPaths(): { ffmpeg: string; ffprobe: string } {
  const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

  if (isLambda) {
    return {
      ffmpeg: '/opt/bin/ffmpeg',
      ffprobe: '/opt/bin/ffprobe'
    };
  } else {
    return {
      ffmpeg: 'ffmpeg',
      ffprobe: 'ffprobe'
    };
  }
}

/**
 * Check if ffmpeg is available on the system
 * Throws an error with installation instructions if not available
 */
export async function checkFfmpegAvailability(): Promise<void> {
  const { ffmpeg } = getBinaryPaths();

  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(ffmpeg, ['-version']);

    ffmpegProcess.on('error', (error) => {
      const errorMessage = `
❌ FFmpeg not found on system.

For local development:
  - macOS: brew install ffmpeg
  - Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg
  - Windows: Download from https://ffmpeg.org/download.html

For Lambda deployment:
  - Ensure ffmpeg Lambda Layer is properly configured in Terraform
  - Check terraform/lambda-layers/README.md for setup instructions

Original error: ${error.message}
      `.trim();

      reject(new Error(errorMessage));
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg check failed with exit code ${code}`));
      }
    });
  });
}

/**
 * Get audio file metadata using ffprobe
 */
export async function getAudioMetadata(filePath: string): Promise<FfprobeMetadata> {
  await checkFfmpegAvailability();
  const { ffprobe } = getBinaryPaths();

  return new Promise((resolve, reject) => {
    const ffprobeProcess = spawn(ffprobe, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed with exit code ${code}: ${stderr}`));
        return;
      }

      try {
        const metadata = JSON.parse(stdout);
        resolve(metadata);
      } catch (error) {
        reject(new Error(`Failed to parse ffprobe output: ${error}`));
      }
    });

    ffprobeProcess.on('error', (error) => {
      reject(new Error(`ffprobe spawn error: ${error.message}`));
    });
  });
}

/**
 * Split audio file into chunks using ffmpeg CLI
 */
export async function createAudioChunk(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  await checkFfmpegAvailability();
  const { ffmpeg } = getBinaryPaths();

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-c', 'copy', // Copy without re-encoding for speed
      '-avoid_negative_ts', 'make_zero',
      outputPath
    ];

    const ffmpegProcess = spawn(ffmpeg, args);

    let stderr = '';

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed with exit code ${code}: ${stderr}`));
        return;
      }
      resolve();
    });

    ffmpegProcess.on('error', (error) => {
      reject(new Error(`ffmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Split audio file into chunks for processing
 */
export async function splitAudioFile(fileKey: string): Promise<TranscriptionChunk[]> {
  log.info(`Splitting audio file: ${fileKey}`);

  // For ffmpeg to work, we need to download the file to a temporary location
  const tempDir = path.join('/tmp', path.dirname(fileKey));
  const tempFilePath = path.join('/tmp', fileKey);

  // Ensure the temp directory exists
  await fs.ensureDir(tempDir);

  // Download the file to the temp location
  const audioBuffer = await getFile(fileKey);

  await fs.writeFile(tempFilePath, audioBuffer);

  // Get audio metadata
  const metadata = await getAudioMetadata(tempFilePath);
  const duration = metadata.format.duration || 0;
  const chunkDuration = CHUNK_DURATION_MINUTES * 60;

  const chunks: TranscriptionChunk[] = [];
  const promises: Promise<void>[] = [];
  let currentStart = 0;

  while (currentStart < duration) {
    const endTime = Math.min(currentStart + chunkDuration, duration);
    const chunkDurationActual = endTime - currentStart;
    const chunkPath = `${tempFilePath}.part${chunks.length + 1}.mp3`;

    chunks.push({
      startTime: currentStart,
      endTime: endTime,
      filePath: chunkPath
    });

    // Create the chunk file using ffmpeg
    promises.push(
      createAudioChunk(tempFilePath, chunkPath, currentStart, chunkDurationActual)
        .then(() => {
          log.info(`Created chunk: ${chunkPath}`);
        })
        .catch((err) => {
          log.error(`Error creating chunk ${chunkPath}:`, err);
          throw err;
        })
    );

    currentStart = endTime;
  }



  try {
    log.info(`Splitting audio file: ${fileKey}, into ${promises.length} chunks`);
    await Promise.all(promises);
    log.info(`Completed splitting audio file: ${fileKey}, into ${chunks.length} chunks`);

    return chunks;
  } catch (error) {
    // Clean up any partial chunks on error
    for (const chunk of chunks) {
      try {
        await fs.remove(chunk.filePath);
      } catch (cleanupError) {
        log.warn(`Failed to clean up chunk ${chunk.filePath}:`, cleanupError);
      }
    }
    throw error;
  }
}

/**
 * Prepare audio file for processing (download to temp location)
 * Returns the local file path and metadata
 */
export async function prepareAudioFile(fileKey: string): Promise<{ filePath: string; metadata: FfprobeMetadata }> {
  const tempDir = path.join('/tmp', path.dirname(fileKey));
  const tempFilePath = path.join('/tmp', fileKey);

  // Ensure the temp directory exists
  await fs.ensureDir(tempDir);

  // Download the file to the temp location
  const audioBuffer = await getFile(fileKey);
  await fs.writeFile(tempFilePath, audioBuffer);

  // Get metadata
  const metadata = await getAudioMetadata(tempFilePath);

  return {
    filePath: tempFilePath,
    metadata
  };
} 