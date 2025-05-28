import { SearchRequest, SearchResponse } from '@listen-fair-play/types';
import { SortOption } from '../types/search';

export interface SearchParams {
  query: string;
  sortOption: SortOption;
  selectedEpisodeIds: number[];
  searchApiBaseUrl: string;
  searchLimit: number;
}

/**
 * Performs a search API request with the specified parameters
 * 
 * @param params - Search parameters including query, sorting, filtering, and API configuration
 * @returns Promise that resolves to the search response data
 * @throws Error if the API request fails
 */
export const performSearch = async (params: SearchParams): Promise<SearchResponse> => {
  const { query, sortOption, selectedEpisodeIds, searchApiBaseUrl, searchLimit } = params;
  
  // Prepare search request with Orama parameters
  const searchRequest: SearchRequest = {
    query: query.trim(),
    limit: searchLimit,
    searchFields: ['text'], // Search only in transcript text
  };

  // Add sorting parameters based on sort option
  if (sortOption === 'newest') {
    searchRequest.sortBy = 'episodePublishedUnixTimestamp';
    searchRequest.sortOrder = 'DESC';
  } else if (sortOption === 'oldest') {
    searchRequest.sortBy = 'episodePublishedUnixTimestamp';
    searchRequest.sortOrder = 'ASC';
  }
  // For 'relevance', we don't add sortBy/sortOrder to use Orama's default relevance scoring

  // Add episode filtering if episodes are selected
  if (selectedEpisodeIds.length > 0) {
    searchRequest.episodeIds = selectedEpisodeIds;
  }

  // Make API request using POST for complex search parameters
  const response = await fetch(`${searchApiBaseUrl}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchRequest),
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data: SearchResponse = await response.json();
  return data;
};

/**
 * Performs a health check request to warm up the search Lambda
 * 
 * @param searchApiBaseUrl - The base URL for the search API
 * @returns Promise that resolves when the Lambda is warmed up
 * @throws Error if the health check request fails
 */
export const performHealthCheck = async (searchApiBaseUrl: string): Promise<void> => {
  const healthCheckRequest: SearchRequest = {
    query: '',
    isHealthCheckOnly: true
  };

  const response = await fetch(`${searchApiBaseUrl}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(healthCheckRequest),
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  // We don't need to process the response, just that it succeeded
  await response.json();
}; 