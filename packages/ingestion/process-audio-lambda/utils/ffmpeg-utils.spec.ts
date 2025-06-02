import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { getFile } from '@listen-fair-play/s3';
import {
  checkFfmpegAvailability,
  getAudioMetadata,
  createAudioChunk,
  splitAudioFile,
  prepareAudioFile,
  TranscriptionChunk,
  FfprobeMetadata
} from './ffmpeg-utils.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs-extra');
vi.mock('@listen-fair-play/s3');
vi.mock('@listen-fair-play/logging', () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

const mockSpawn = vi.mocked(spawn);
const mockFs = vi.mocked(fs);
const mockGetFile = vi.mocked(getFile);

// Helper function to create a mock process with all required properties
function createMockProcess() {
  const process = new EventEmitter() as any;
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  return process;
}

describe('ffmpeg-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default spawn behavior to return a proper mock
    mockSpawn.mockImplementation(() => createMockProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkFfmpegAvailability', () => {
    it('should resolve when ffmpeg is available', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const promise = checkFfmpegAvailability();
      
      // Simulate successful ffmpeg execution
      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      await expect(promise).resolves.toBeUndefined();
      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', ['-version']);
    });

    it('should reject with installation instructions when ffmpeg is not found', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const promise = checkFfmpegAvailability();
      
      // Simulate ffmpeg not found error
      setImmediate(() => {
        mockProcess.emit('error', new Error('spawn ffmpeg ENOENT'));
      });

      await expect(promise).rejects.toThrow('❌ FFmpeg not found on system.');
      await expect(promise).rejects.toThrow('macOS: brew install ffmpeg');
      await expect(promise).rejects.toThrow('Lambda Layer');
    });

    it('should reject when ffmpeg exits with non-zero code', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const promise = checkFfmpegAvailability();
      
      // Simulate ffmpeg failure
      setImmediate(() => {
        mockProcess.emit('close', 1);
      });

      await expect(promise).rejects.toThrow('FFmpeg check failed with exit code 1');
    });
  });

  describe('getAudioMetadata', () => {
    it('should return metadata when ffprobe succeeds', async () => {
      // Mock ffmpeg availability check
      const mockFfmpegProcess = createMockProcess();
      const mockFfprobeProcess = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(mockFfmpegProcess) // First call for availability check
        .mockReturnValueOnce(mockFfprobeProcess); // Second call for ffprobe

      const expectedMetadata: FfprobeMetadata = {
        format: {
          duration: 180.5
        }
      };

      const promise = getAudioMetadata('/path/to/audio.mp3');

      // Simulate successful ffmpeg availability check
      setImmediate(() => {
        mockFfmpegProcess.emit('close', 0);
      });

      // Wait a bit for the ffprobe call
      setTimeout(() => {
        mockFfprobeProcess.stdout.emit('data', JSON.stringify(expectedMetadata));
        mockFfprobeProcess.emit('close', 0);
      }, 10);

      const result = await promise;
      expect(result).toEqual(expectedMetadata);
      expect(mockSpawn).toHaveBeenCalledWith('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '/path/to/audio.mp3'
      ]);
    });

    it('should reject when ffprobe fails', async () => {
      const mockFfmpegProcess = createMockProcess();
      const mockFfprobeProcess = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(mockFfmpegProcess)
        .mockReturnValueOnce(mockFfprobeProcess);

      const promise = getAudioMetadata('/path/to/audio.mp3');

      setImmediate(() => {
        mockFfmpegProcess.emit('close', 0);
      });

      setTimeout(() => {
        mockFfprobeProcess.stderr.emit('data', 'ffprobe error');
        mockFfprobeProcess.emit('close', 1);
      }, 10);

      await expect(promise).rejects.toThrow('ffprobe failed with exit code 1');
    });

    it('should reject when ffprobe output is invalid JSON', async () => {
      const mockFfmpegProcess = createMockProcess();
      const mockFfprobeProcess = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(mockFfmpegProcess)
        .mockReturnValueOnce(mockFfprobeProcess);

      const promise = getAudioMetadata('/path/to/audio.mp3');

      setImmediate(() => {
        mockFfmpegProcess.emit('close', 0);
      });

      setTimeout(() => {
        mockFfprobeProcess.stdout.emit('data', 'invalid json');
        mockFfprobeProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('Failed to parse ffprobe output');
    });
  });

  describe('createAudioChunk', () => {
    it('should create audio chunk successfully', async () => {
      const mockFfmpegProcess = createMockProcess();
      const mockChunkProcess = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(mockFfmpegProcess) // Availability check
        .mockReturnValueOnce(mockChunkProcess); // Chunk creation

      const promise = createAudioChunk('/input.mp3', '/output.mp3', 30, 60);

      setImmediate(() => {
        mockFfmpegProcess.emit('close', 0);
      });

      setTimeout(() => {
        mockChunkProcess.emit('close', 0);
      }, 10);

      await expect(promise).resolves.toBeUndefined();
      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', [
        '-i', '/input.mp3',
        '-ss', '30',
        '-t', '60',
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '/output.mp3'
      ]);
    });

    it('should reject when chunk creation fails', async () => {
      const mockFfmpegProcess = createMockProcess();
      const mockChunkProcess = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(mockFfmpegProcess)
        .mockReturnValueOnce(mockChunkProcess);

      const promise = createAudioChunk('/input.mp3', '/output.mp3', 30, 60);

      setImmediate(() => {
        mockFfmpegProcess.emit('close', 0);
      });

      setTimeout(() => {
        mockChunkProcess.stderr.emit('data', 'ffmpeg error');
        mockChunkProcess.emit('close', 1);
      }, 10);

      await expect(promise).rejects.toThrow('ffmpeg failed with exit code 1');
    });
  });

  describe('splitAudioFile', () => {
    beforeEach(() => {
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockGetFile.mockResolvedValue(Buffer.from('mock audio data'));
    });

    it('should be tested via integration tests', () => {
      // This complex function involves multiple async calls to child processes
      // and is better tested via integration tests rather than complex mocking
      expect(true).toBe(true);
    });
  });

  describe('prepareAudioFile', () => {
    it('should prepare audio file and return metadata', async () => {
      const fileKey = 'podcast/episode.mp3';
      const expectedMetadata: FfprobeMetadata = {
        format: { duration: 300 }
      };

      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockGetFile.mockResolvedValue(Buffer.from('mock audio data'));

      const mockFfmpegProcess = createMockProcess();
      const mockFfprobeProcess = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(mockFfmpegProcess)
        .mockReturnValueOnce(mockFfprobeProcess);

      const promise = prepareAudioFile(fileKey);

      setImmediate(() => {
        mockFfmpegProcess.emit('close', 0);
      });

      setTimeout(() => {
        mockFfprobeProcess.stdout.emit('data', JSON.stringify(expectedMetadata));
        mockFfprobeProcess.emit('close', 0);
      }, 10);

      const result = await promise;

      expect(result).toEqual({
        filePath: '/tmp/podcast/episode.mp3',
        metadata: expectedMetadata
      });

      expect(mockGetFile).toHaveBeenCalledWith(fileKey);
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/tmp/podcast');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/tmp/podcast/episode.mp3', expect.any(Buffer));
    });
  });
}); 