import fs from 'fs';
import { transcribeViaWhisper } from '../transcribe-via-whisper';

// Mock dependencies
jest.mock('fs');
jest.mock('openai');
jest.mock('@listen-fair-play/logging');

// Mock global fetch
global.fetch = jest.fn();

// Mock OpenAI module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn()
        }
      }
    }))
  };
});

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('transcribeViaWhisper', () => {
  const mockFilePath = '/path/to/audio.mp3';
  const mockApiKey = 'test-api-key';
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.createReadStream.mockReturnValue({} as any);
    mockFs.readFileSync.mockReturnValue(Buffer.from('mock audio data'));
    
    // Mock environment variables
    process.env.OPENAI_API_KEY = mockApiKey;
    process.env.REPLICATE_API_KEY = mockApiKey;
    process.env.DEEPGRAM_API_KEY = mockApiKey;
  });

  afterEach(() => {
    jest.resetAllMocks();
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
      const OpenAI = require('openai').default;
      const mockCreate = jest.fn().mockResolvedValue('Mock SRT content');
      OpenAI.mockImplementation(() => ({
        audio: {
          transcriptions: {
            create: mockCreate
          }
        }
      }));

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'openai',
        responseFormat: 'srt'
      });

      expect(result).toBe('Mock SRT content');
      expect(mockCreate).toHaveBeenCalledWith({
        file: expect.anything(),
        model: 'whisper-1',
        response_format: 'srt'
      });
    });

    it('should retry on timeout errors', async () => {
      const OpenAI = require('openai').default;
      const mockCreate = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('Success after retries');

      OpenAI.mockImplementation(() => ({
        audio: {
          transcriptions: {
            create: mockCreate
          }
        }
      }));

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'openai'
      });

      expect(result).toBe('Success after retries');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const OpenAI = require('openai').default;
      const mockCreate = jest.fn()
        .mockRejectedValue(new Error('ECONNRESET'));

      OpenAI.mockImplementation(() => ({
        audio: {
          transcriptions: {
            create: mockCreate
          }
        }
      }));

      await expect(transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'openai'
      })).rejects.toThrow('ECONNRESET');

      expect(mockCreate).toHaveBeenCalledTimes(3); // Initial + 2 retries
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
                { word: 'world', start: 0.6, end: 1.0 },
                { word: 'this', start: 1.1, end: 1.4 },
                { word: 'is', start: 1.5, end: 1.7 },
                { word: 'a', start: 1.8, end: 1.9 },
                { word: 'test', start: 2.0, end: 2.3 }
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

      expect(result).toContain('Hello world this is a test');
      expect(result).toContain('00:00:00,000 --> 00:00:02,300');
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

    it('should retry on connection errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            results: { channels: [{ alternatives: [{ words: [] }] }] }
          })
        } as Response);

      const result = await transcribeViaWhisper({
        filePath: mockFilePath,
        whisperApiProvider: 'deepgram'
      });

      expect(result).toBe('');
      expect(mockFetch).toHaveBeenCalledTimes(2);
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