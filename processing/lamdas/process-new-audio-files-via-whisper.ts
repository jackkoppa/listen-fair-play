import fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import SrtParser from 'srt-parser-2';
import { config } from '@dotenvx/dotenvx';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const AUDIO_DIR = path.join(__dirname, '../audio');
const TRANSCRIPTS_DIR = path.join(__dirname, '../transcripts');
const MAX_FILE_SIZE_MB = 25;
const CHUNK_DURATION_MINUTES = 10; // Approximate chunk size to stay under 25MB

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
async function getMp3Files(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  return files.filter(file => file.endsWith('.mp3'));
}

// Helper function to check if transcription exists
async function transcriptExists(filePath: string): Promise<boolean> {
  const audioFileName = path.basename(filePath, path.extname(filePath));
  const transcriptDir = path.join(TRANSCRIPTS_DIR, path.dirname(filePath).split('/').pop() || '');
  const transcriptPath = path.join(transcriptDir, `${audioFileName}.srt`);
  
  return fs.pathExists(transcriptPath);
}

// Helper function to split audio file into chunks
async function splitAudioFile(filePath: string): Promise<TranscriptionChunk[]> {
  return new Promise((resolve, reject) => {
    const chunks: TranscriptionChunk[] = [];
    let currentStart = 0;
    
    ffmpeg.ffprobe(filePath, async (err: Error | null, metadata: FfprobeMetadata) => {
      if (err) reject(err);
      
      const duration = metadata.format.duration || 0;
      const chunkDuration = CHUNK_DURATION_MINUTES * 60;
      
      const promises: Promise<void>[] = [];
      
      while (currentStart < duration) {
        const endTime = Math.min(currentStart + chunkDuration, duration);
        const chunkPath = `${filePath}.part${chunks.length + 1}.mp3`;
        
        chunks.push({
          startTime: currentStart,
          endTime: endTime,
          filePath: chunkPath
        });
        
        // Actually create the chunk file using ffmpeg
        promises.push(new Promise<void>((resolveChunk, rejectChunk) => {
          ffmpeg(filePath)
            .setStartTime(currentStart)
            .setDuration(endTime - currentStart)
            .output(chunkPath)
            .on('end', () => {
              console.log(`Created chunk: ${chunkPath}`);
              resolveChunk();
            })
            .on('error', (err) => {
              console.error(`Error creating chunk ${chunkPath}:`, err);
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
          console.log(`Skipping entry with invalid timestamp: ${JSON.stringify(entry)}`);
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
      console.error(`Error parsing SRT content for chunk ${index}:`, error);
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
async function processAudioFile(filePath: string): Promise<void> {
  const podcastDir = path.dirname(filePath);
  const podcastName = path.basename(podcastDir);
  const transcriptDir = path.join(TRANSCRIPTS_DIR, podcastName);
  const audioFileName = path.basename(filePath, '.mp3');
  
  // Ensure transcript directory exists
  await fs.ensureDir(transcriptDir);
  
  // Check if transcription already exists
  const transcriptPath = path.join(transcriptDir, `${audioFileName}.srt`);
  if (await transcriptExists(filePath)) {
    console.log(`Transcript already exists for ${filePath}, skipping`);
    return;
  }
  
  // Get file size
  const stats = await fs.stat(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  
  let chunks: TranscriptionChunk[] = [];
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    console.log(`File ${filePath} is too large (${fileSizeMB.toFixed(2)}MB). Splitting into chunks...`);
    chunks = await splitAudioFile(filePath);
  } else {
    chunks = [{
      startTime: 0,
      endTime: 0, // Will be determined by ffprobe
      filePath: filePath
    }];
  }
  
  // Process each chunk
  const srtContents: string[] = [];
  for (const chunk of chunks) {
    console.log(`Processing chunk: ${chunk.filePath}`);
    
    // Get file duration if not already set
    if (chunk.endTime === 0) {
      const metadata = await new Promise<FfprobeMetadata>((resolve, reject) => {
        ffmpeg.ffprobe(chunk.filePath, (err, metadata) => {
          if (err) reject(err);
          resolve(metadata);
        });
      });
      chunk.endTime = metadata.format.duration || 0;
    }
    
    // Process with Whisper API
    const openai = new OpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(chunk.filePath),
      model: "whisper-1",
      response_format: "srt"
    });
    
    srtContents.push(transcription);
    
    // Clean up chunk file if it was created by splitting
    if (chunk.filePath !== filePath) {
      await fs.remove(chunk.filePath);
    }
  }
  
  // Combine SRT files if needed
  const finalSrt = chunks.length > 1 ? combineSrtFiles(srtContents) : srtContents[0];
  
  // Save the final SRT file
  await fs.writeFile(transcriptPath, finalSrt);
  
  // Add more visual prominence to completion message
  console.log('\n---------------------------------------------------');
  console.log(`✅ COMPLETED: Saved transcription to ${transcriptPath}`);
  console.log('---------------------------------------------------\n');
}

/**
 * Lambda handler function
 */
export async function handler(event: { audioFiles?: string[] } = {}): Promise<void> {
  try {
    // Ensure directories exist
    await fs.ensureDir(AUDIO_DIR);
    await fs.ensureDir(TRANSCRIPTS_DIR);
    
    console.log('Received event:', event);
    
    // Get all podcast directories
    const podcastDirs = await fs.readdir(AUDIO_DIR);
    
    // Process each podcast directory
    for (const podcastDir of podcastDirs) {
      const podcastPath = path.join(AUDIO_DIR, podcastDir);
      const stats = await fs.stat(podcastPath);
      
      if (stats.isDirectory()) {
        console.log(`Processing podcast directory: ${podcastDir}`);
        
        // Get all MP3 files in the directory
        const mp3Files = await getMp3Files(podcastPath);
        
        // Process each MP3 file
        for (const mp3File of mp3Files) {
          const filePath = path.join(podcastPath, mp3File);
          try {
            await processAudioFile(filePath);
          } catch (error) {
            console.error(`Error processing ${filePath}:`, error);
            // Continue with next file even if one fails
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error in audio processing:', error);
    throw error;
  }
}

// For local development, call the handler directly
// In ES modules, we can use the import.meta.url to check if this is the main module
const isMainModule = import.meta.url.endsWith(process.argv[1].replace('file://', ''));

if (isMainModule) {
  console.log('Starting audio processing via Whisper - running via pnpm...');
  const mockEvent = {
    audioFiles: [
      // Example audio files that would be passed from Lambda-1
      path.join(AUDIO_DIR, 'example-file.mp3')
    ]
  };
  
  handler(mockEvent)
    .then(() => console.log('Processing completed successfully'))
    .catch(error => {
      console.error('Processing failed:', error);
      process.exit(1);
    });
} 