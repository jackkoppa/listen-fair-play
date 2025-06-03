import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '@listen-fair-play/logging';
import {
  RETRY_MAX_ATTEMPTS,
  RETRY_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
  REPLICATE_POLL_INTERVAL_MS
} from './temp-env-constants';
/**
 * `openai` has been confirmed to work
 * `replicate` now implemented with retry logic
 * `deepgram` now implemented with retry logic
 * `local-whisper.cpp` has been confirmed to work - see README for setup details, to setup local whisper.cpp model
 */
export type WhisperApiProvider = 'openai' | 'replicate' | 'deepgram' | 'local-whisper.cpp';

/** For now, we only use .srt, and may try .json later. There are others we could add here as well; check OpenAI types for more. */
type ResponseFormat = 'srt' | 'json';

interface TranscribeOptions {
  /** The path to the audio file to transcribe */
  filePath: string;
  /** The API provider to use for transcription */
  whisperApiProvider: WhisperApiProvider;
  /** The response format to request - defaults to SRT */
  responseFormat?: ResponseFormat;
  /** The Whisper model to use */
  model?: string;
  /** API key for the selected provider (if not using environment variables) */
  apiKey?: string;
  /** Path to whisper.cpp directory (if not using environment variables) */
  whisperCppPath?: string;
}

interface RetryableError extends Error {
  isRetryable?: boolean;
}

/**
 * Generic retry wrapper with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = RETRY_MAX_ATTEMPTS,
  timeoutMs: number = RETRY_TIMEOUT_MS,
  baseDelayMs: number = RETRY_BASE_DELAY_MS
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Wrap operation with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
      });
      
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error as Error);
      
      log.warn(`Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
      
      if (attempt === maxAttempts || !isRetryable) {
        throw lastError;
      }
      
      // Exponential backoff delay
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      log.info(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    'ECONNRESET',
    'ETIMEDOUT', 
    'ENOTFOUND',
    'ECONNREFUSED',
    'timeout',
    'network error',
    'rate limit',
    'service unavailable',
    'internal server error'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Transcribes an audio file using the specified Whisper API provider
 * @param options Transcription options
 * @returns The transcription as a string in the requested format
 */
export async function transcribeViaWhisper(options: TranscribeOptions): Promise<string> {
  const {
    filePath,
    whisperApiProvider,
    responseFormat = 'srt',
    apiKey,
    whisperCppPath
  } = options;

  // Validate the file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  switch (whisperApiProvider) {
    case 'openai':
      return withRetry(() => transcribeWithOpenAI(filePath, responseFormat, apiKey));
    case 'replicate':
      return withRetry(() => transcribeWithReplicate(filePath, apiKey));
    case 'deepgram':
      return withRetry(() => transcribeWithDeepgram(filePath, responseFormat, apiKey));
    case 'local-whisper.cpp':
      return transcribeWithLocalWhisperCpp(filePath, responseFormat, whisperCppPath);
    default:
      throw new Error(`Unsupported API provider: ${whisperApiProvider}`);
  }
}

/**
 * Transcribes using OpenAI's Whisper API
 */
async function transcribeWithOpenAI(
  filePath: string,
  responseFormat: ResponseFormat,
  apiKey?: string
): Promise<string> {
  const openai = new OpenAI({ apiKey });

  // Default for OpenAI usage
  const model = 'whisper-1';
  
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model,
    response_format: responseFormat,
  });

  // Handle the return type correctly based on OpenAI API
  return transcription as unknown as string;
}

/**
 * Transcribes using Replicate's Whisper API
 */
async function transcribeWithReplicate(
  filePath: string,
  apiKey?: string
): Promise<string> {
  // Replicate API requires a token either from params or environment variable
  const token = apiKey || process.env.REPLICATE_API_KEY;
  
  if (!token) {
    throw new Error('REPLICATE_API_KEY is required for Replicate API');
  }

  // Read the file as base64
  const fileBuffer = fs.readFileSync(filePath);
  const base64Audio = fileBuffer.toString('base64');
  const mimeType = getMimeType(filePath);
  
  // Call Replicate API to create prediction
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: "30414ee7c4fffc37e260fcab7842b5be470b9b840f2b608f5baa9bbef9a259ed", // Latest whisper model
      input: {
        audio: `data:${mimeType};base64,${base64Audio}`,
        output_format: "srt"
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Replicate API error: ${response.status} ${errorText}`);
  }

  const prediction = await response.json() as any;
  
  // If the prediction is not complete, we need to poll for the result
  if (prediction.status === 'starting' || prediction.status === 'processing') {
    return await pollReplicateResult(prediction.id, token);
  } else if (prediction.status === 'succeeded') {
    return prediction.output || '';
  } else if (prediction.status === 'failed') {
    throw new Error(`Replicate transcription failed: ${prediction.error}`);
  }
  
  return prediction.output || '';
}

/**
 * Transcribes using Deepgram's Whisper Cloud API
 */
async function transcribeWithDeepgram(
  filePath: string,
  responseFormat: ResponseFormat,
  apiKey?: string
): Promise<string> {
  const token = apiKey || process.env.DEEPGRAM_API_KEY;
  
  if (!token) {
    throw new Error('DEEPGRAM_API_KEY is required for Deepgram API');
  }

  // For Deepgram, we can send the file directly or as a URL
  // We'll use direct file upload
  const fileBuffer = fs.readFileSync(filePath);
  
  // Determine model - default to whisper-medium
  const model = 'whisper-medium';
  
  const response = await fetch(`https://api.deepgram.com/v1/listen?model=${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': getMimeType(filePath),
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error: ${response.status} ${errorText}`);
  }

  const result = await response.json() as any;
  
  // Convert Deepgram response to SRT format if needed
  if (responseFormat === 'srt') {
    return convertDeepgramToSrt(result);
  } else {
    return JSON.stringify(result, null, 2);
  }
}

/**
 * Converts Deepgram response to SRT format
 */
function convertDeepgramToSrt(deepgramResponse: any): string {
  const words = deepgramResponse.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  
  if (words.length === 0) {
    return '';
  }
  
  let srtContent = '';
  let segmentIndex = 1;
  let currentSegment = '';
  let segmentStart = 0;
  let segmentEnd = 0;
  const maxSegmentLength = 80; // Characters per subtitle segment
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordText = word.word || '';
    const wordStart = word.start || 0;
    const wordEnd = word.end || 0;
    
    if (currentSegment === '') {
      segmentStart = wordStart;
    }
    
    // Add the current word to the segment
    currentSegment += (currentSegment ? ' ' : '') + wordText;
    segmentEnd = wordEnd;
    
    // If we hit max length or it's the last word, write out the segment
    if (currentSegment.length > maxSegmentLength || i === words.length - 1) {
      if (currentSegment.trim()) {
        srtContent += `${segmentIndex}\n`;
        srtContent += `${formatSrtTime(segmentStart)} --> ${formatSrtTime(segmentEnd)}\n`;
        srtContent += `${currentSegment.trim()}\n\n`;
        segmentIndex++;
      }
      
      // Reset for the next segment
      currentSegment = '';
    }
  }
  
  return srtContent;
}

/**
 * Formats time in SRT format (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Gets MIME type based on file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm'
  };
  
  return mimeTypes[ext] || 'audio/mpeg';
}

/**
 * Transcribes using locally installed whisper.cpp
 */
async function transcribeWithLocalWhisperCpp(
  filePath: string,
  responseFormat: string,
  whisperCppPath?: string
): Promise<string> {
  const execPromise = promisify(exec);

  const whisperCPPModel = process.env.WHISPER_CPP_MODEL;
  
  // Get whisper.cpp directory from options or environment variable
  const whisperDir = whisperCppPath || process.env.WHISPER_CPP_PATH;
  
  if (!whisperDir) {
    throw new Error('WHISPER_CPP_PATH environment variable or whisperCppPath option is required for local-whisper.cpp');
  }
  
  // Validate whisper.cpp directory exists
  if (!fs.existsSync(whisperDir)) {
    throw new Error(`whisper.cpp directory not found at: ${whisperDir}`);
  }
  
  // Path to the whisper-cli executable
  const whisperCliBin = path.join(whisperDir, 'build/bin/whisper-cli');
  
  // Validate whisper-cli executable exists
  if (!fs.existsSync(whisperCliBin)) {
    throw new Error(`whisper-cli executable not found at: ${whisperCliBin}. Make sure whisper.cpp is compiled.`);
  }
  
  const whisperModel = `ggml-${whisperCPPModel}.bin`
  const modelPath = path.join(whisperDir, 'models', whisperModel);
  
  // Validate model exists
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Whisper model not found at: ${modelPath}`);
  }

  // Create temporary output file for transcription
  const tempOutputDir = path.dirname(filePath);

  const tempOutputFile = path.join(tempOutputDir, `${path.basename(filePath, path.extname(filePath))}`);
  const tempOutputFileWithExtension = `${tempOutputFile}.${responseFormat}`;
  // Determine output format flag
  let formatFlag = '';
  switch (responseFormat) {
    case 'srt':
      formatFlag = '--output-srt';
      break;
    case 'vtt':
      formatFlag = '--output-vtt';
      break;
    case 'json':
      formatFlag = '--output-json';
      break;
    case 'text':
    default:
      formatFlag = '--output-txt';
      break;
  }
  
  try {
    // Run whisper.cpp command
    const command = `cd "${whisperDir}" && "${whisperCliBin}" -m "${modelPath}" -f "${filePath}" ${formatFlag} -of "${tempOutputFile}" --prompt "Hello. Welcome to the Football Clichés podcast! I am your host, Adam Hurrey. Let's begin."`;

    const { stdout, stderr } = await execPromise(command);
    
    // Read the output file
    if (fs.existsSync(tempOutputFileWithExtension)) {
      const transcription = fs.readFileSync(tempOutputFileWithExtension, 'utf-8');
      // Clean up temp file
      fs.unlinkSync(tempOutputFileWithExtension);
      return transcription;
    } else {
      log.debug('\n◻️ whisper.cpp, stdout:\n', stdout, '\n\n');
      log.debug('\n❌ whisper.cpp, stderr:\n', stderr, '\n\n');
      throw new Error(`Output file not created: ${tempOutputFileWithExtension}. See above for more details.`);
    }
  } catch (error) {
    throw new Error(`Failed to run whisper.cpp: ${(error as Error).message}`);
  }
}

/**
 * Polls Replicate API for the prediction result
 */
async function pollReplicateResult(predictionId: string, token: string): Promise<string> {
  const maxAttempts = 30;
  const delayMs = REPLICATE_POLL_INTERVAL_MS;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error polling Replicate: ${response.status} ${errorText}`);
    }

    const prediction = await response.json() as any;
    
    if (prediction.status === 'succeeded') {
      return prediction.output || '';
    } else if (prediction.status === 'failed') {
      throw new Error(`Replicate transcription failed: ${prediction.error}`);
    }
    
    // Wait before the next polling attempt
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error(`Replicate transcription timed out after ${maxAttempts} polling attempts`);
} 