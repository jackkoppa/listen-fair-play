import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { transcribeViaWhisper } from '../transcribe-via-whisper';

// Mock dependencies
vi.mock('fs');
vi.mock('@listen-fair-play/logging');

// Mock global fetch
global.fetch = vi.fn();

// Create mock for OpenAI transcription function that will be shared
const mockOpenAICreate = vi.fn();

// Mock OpenAI module with the correct structure
vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      return {
        audio: {
          transcriptions: {
            create: mockOpenAICreate
          }
        }
      };
    }
  }
}));

const mockFs = fs as any;
const mockFetch = global.fetch as any;

describe('transcribeViaWhisper', () => {
  const mockFilePath = '/path/to/audio.mp3';
  const mockApiKey = 'test-api-key';
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.createReadStream = vi.fn().mockReturnValue({} as any);
    mockFs.readFileSync = vi.fn().mockReturnValue(Buffer.from('mock audio data'));
    
    // Mock environment variables
    process.env.OPENAI_API_KEY = mockApiKey;
    process.env.REPLICATE_API_KEY = mockApiKey;
    process.env.DEEPGRAM_API_KEY = mockApiKey;
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.REPLICATE_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
  });

  describe('File validation', () => {
    it('should throw error if file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      await expect(transcribeViaWhisper({
        filePath: '/nonexistent/file.mp3',
        whisperApiProvider: 'openai'
      })).rejects.toThrow('File not found: /nonexistent/file.mp3');
    });
  });

  describe('OpenAI provider', () => {
    it('should successfully transcribe with OpenAI', async () => {
      mockOpenAICreate.mockResolvedValue('Mock SRT content');

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'openai',
        responseFormat: 'srt'
      });

      expect(result).toBe('Mock SRT content');
      expect(mockOpenAICreate).toHaveBeenCalledWith({
        file: expect.anything(),
        model: 'whisper-1',
        response_format: 'srt'
      });
    });

    it('should use JSON format when requested', async () => {
      mockOpenAICreate.mockResolvedValue({ text: 'Mock JSON content' });

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'openai',
        responseFormat: 'json'
      });

      expect(result).toEqual({ text: 'Mock JSON content' });
      expect(mockOpenAICreate).toHaveBeenCalledWith({
        file: expect.anything(),
        model: 'whisper-1',
        response_format: 'json'
      });
    });
  });

  describe('Replicate provider', () => {
    it('should successfully transcribe with Replicate (immediate success)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred_123',
          status: 'succeeded',
          output: 'Mock SRT content from Replicate'
        })
      } as Response);

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'replicate'
      });

      expect(result).toBe('Mock SRT content from Replicate');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.replicate.com/v1/predictions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Token ${mockApiKey}`
          })
        })
      );
    });

    it('should poll for result when prediction is processing', async () => {
      // First call - create prediction (processing)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred_123',
          status: 'processing'
        })
      } as Response);

      // Second call - poll result (still processing)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred_123',
          status: 'processing'
        })
      } as Response);

      // Third call - poll result (succeeded)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred_123',
          status: 'succeeded',
          output: 'Polled SRT content'
        })
      } as Response);

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'replicate'
      });

      expect(result).toBe('Polled SRT content');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.REPLICATE_API_KEY;

      await expect(transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'replicate'
      })).rejects.toThrow('REPLICATE_API_KEY is required for Replicate API');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      } as Response);

      await expect(transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'replicate'
      })).rejects.toThrow('Replicate API error: 400 Bad Request');
    });

    it('should handle failed predictions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred_123',
          status: 'failed',
          error: 'Audio processing failed'
        })
      } as Response);

      await expect(transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'replicate'
      })).rejects.toThrow('Replicate transcription failed: Audio processing failed');
    });
  });

  describe('Deepgram provider', () => {
    it('should successfully transcribe with Deepgram', async () => {
      const mockDeepgramResponse = {
        results: {
          channels: [{
            alternatives: [{
              words: [
                { word: 'Hello', start: 0.0, end: 0.5 },
                { word: 'world', start: 0.6, end: 1.0 }
              ]
            }]
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeepgramResponse)
      } as Response);

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram',
        responseFormat: 'srt'
      });

      // Check that the SRT contains the expected words - they get combined into segments
      expect(result).toContain('Hello');
      expect(result).toContain('00:00:00,000 --> 00:00:01,000');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepgram.com/v1/listen?model=whisper-medium',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Token ${mockApiKey}`,
            'Content-Type': 'audio/mpeg'
          })
        })
      );
    });

    it('should return JSON when requested format is json', async () => {
      const mockDeepgramResponse = {
        results: { channels: [] }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeepgramResponse)
      } as Response);

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram',
        responseFormat: 'json'
      });

      expect(result).toBe(JSON.stringify(mockDeepgramResponse, null, 2));
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.DEEPGRAM_API_KEY;

      await expect(transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram'
      })).rejects.toThrow('DEEPGRAM_API_KEY is required for Deepgram API');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      } as Response);

      await expect(transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram'
      })).rejects.toThrow('Deepgram API error: 401 Unauthorized');
    });

    it('should handle connection errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'));

      await expect(transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram'
      })).rejects.toThrow('ECONNRESET');
    });
  });

  describe('Unsupported provider', () => {
    it('should throw error for unsupported provider', async () => {
      await expect(transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'unsupported' as any
      })).rejects.toThrow('Unsupported API provider: unsupported');
    });
  });

  describe('SRT formatting', () => {
    it('should format SRT timestamps correctly', async () => {
      const mockDeepgramResponse = {
        results: {
          channels: [{
            alternatives: [{
              words: [
                { word: 'Test', start: 3661.5, end: 3662.0 } // 1 hour, 1 minute, 1.5 seconds
              ]
            }]
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeepgramResponse)
      } as Response);

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram',
        responseFormat: 'srt'
      });

      expect(result).toContain('01:01:01,500 --> 01:01:02,000');
      expect(result).toContain('Test');
    });

    it('should handle long segments properly', async () => {
      const longText = Array(20).fill('word').map((w, i) => ({
        word: `${w}${i}`,
        start: i * 0.5,
        end: (i + 1) * 0.5
      }));

      const mockDeepgramResponse = {
        results: {
          channels: [{
            alternatives: [{
              words: longText
            }]
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeepgramResponse)
      } as Response);

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram',
        responseFormat: 'srt'
      });

      // Should create multiple subtitle segments
      const segments = result.split('\n\n').filter(s => s.trim());
      expect(segments.length).toBeGreaterThan(1);
    });

    it('should handle empty word arrays', async () => {
      const mockDeepgramResponse = {
        results: {
          channels: [{
            alternatives: [{
              words: []
            }]
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeepgramResponse)
      } as Response);

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram',
        responseFormat: 'srt'
      });

      expect(result).toBe('');
    });
  });

  describe('MIME type detection', () => {
    it('should detect correct MIME types for different file extensions', async () => {
      const testCases = [
        { path: '/test.mp3', expectedType: 'audio/mpeg' },
        { path: '/test.wav', expectedType: 'audio/wav' },
        { path: '/test.m4a', expectedType: 'audio/mp4' },
        { path: '/test.aac', expectedType: 'audio/aac' },
        { path: '/test.unknown', expectedType: 'audio/mpeg' } // default
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            results: { channels: [{ alternatives: [{ words: [] }] }] }
          })
        } as Response);

        await transcribeViaWhisper({
          filePath: testCase.path,
          whisperApiProvider: 'deepgram'
        });

        expect(mockFetch).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': testCase.expectedType
            })
          })
        );
      }
    });
  });
}); 