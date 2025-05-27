import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performHealthCheck, performSearch } from '../search';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Search Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('performHealthCheck', () => {
    it('makes a POST request with health check parameter', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          hits: [], 
          totalHits: 0, 
          processingTimeMs: 250,
          query: 'health-check' 
        }),
      });

      const baseUrl = 'https://api.example.com';
      await performHealthCheck(baseUrl);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: '',
            isHealthCheckOnly: true,
          }),
        }
      );
    });

    it('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const baseUrl = 'https://api.example.com';
      
      await expect(performHealthCheck(baseUrl)).rejects.toThrow(
        'Health check failed with status 500'
      );
    });

    it('throws error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const baseUrl = 'https://api.example.com';
      
      await expect(performHealthCheck(baseUrl)).rejects.toThrow('Network error');
    });

    it('processes response JSON even if not needed', async () => {
      const mockJson = vi.fn().mockResolvedValue({ status: 'ok' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: mockJson,
      });

      const baseUrl = 'https://api.example.com';
      await performHealthCheck(baseUrl);

      expect(mockJson).toHaveBeenCalled();
    });
  });

  describe('performSearch', () => {
    it('makes a POST request with correct search parameters', async () => {
      const mockResponse = {
        hits: [
          {
            id: 'test-1',
            text: 'test quote',
            sequentialEpisodeIdAsString: '1',
            startTimeMs: 1000,
            endTimeMs: 2000,
            episodePublishedUnixTimestamp: 1640995200,
          }
        ],
        totalHits: 1,
        processingTimeMs: 150,
        query: 'test query',
        sortBy: 'episodePublishedUnixTimestamp',
        sortOrder: 'DESC',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const searchParams = {
        query: 'test query',
        sortOption: 'newest' as const,
        selectedEpisodeIds: [1, 2],
        searchApiBaseUrl: 'https://api.example.com',
        searchLimit: 10,
      };

      const result = await performSearch(searchParams);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'test query',
            limit: 10,
            sortBy: 'episodePublishedUnixTimestamp',
            sortOrder: 'DESC',
            episodeIds: [1, 2],
          }),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('handles relevance sort option correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hits: [], totalHits: 0, processingTimeMs: 100 }),
      });

      await performSearch({
        query: 'test',
        sortOption: 'relevance',
        selectedEpisodeIds: [],
        searchApiBaseUrl: 'https://api.example.com',
        searchLimit: 10,
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.sortBy).toBeUndefined();
      expect(requestBody.sortOrder).toBe('DESC');
    });

    it('handles oldest sort option correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hits: [], totalHits: 0, processingTimeMs: 100 }),
      });

      await performSearch({
        query: 'test',
        sortOption: 'oldest',
        selectedEpisodeIds: [],
        searchApiBaseUrl: 'https://api.example.com',
        searchLimit: 10,
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.sortBy).toBe('episodePublishedUnixTimestamp');
      expect(requestBody.sortOrder).toBe('ASC');
    });

    it('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(performSearch({
        query: 'test',
        sortOption: 'relevance',
        selectedEpisodeIds: [],
        searchApiBaseUrl: 'https://api.example.com',
        searchLimit: 10,
      })).rejects.toThrow('Search request failed: 400 Bad Request');
    });

    it('throws error when network request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(performSearch({
        query: 'test',
        sortOption: 'relevance',
        selectedEpisodeIds: [],
        searchApiBaseUrl: 'https://api.example.com',
        searchLimit: 10,
      })).rejects.toThrow('Connection refused');
    });

    it('excludes episodeIds when array is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hits: [], totalHits: 0, processingTimeMs: 100 }),
      });

      await performSearch({
        query: 'test',
        sortOption: 'relevance',
        selectedEpisodeIds: [],
        searchApiBaseUrl: 'https://api.example.com',
        searchLimit: 10,
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).not.toHaveProperty('episodeIds');
    });

    it('includes episodeIds when array has values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hits: [], totalHits: 0, processingTimeMs: 100 }),
      });

      await performSearch({
        query: 'test',
        sortOption: 'relevance',
        selectedEpisodeIds: [1, 5, 10],
        searchApiBaseUrl: 'https://api.example.com',
        searchLimit: 25,
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.episodeIds).toEqual([1, 5, 10]);
      expect(requestBody.limit).toBe(25);
    });
  });
}); 