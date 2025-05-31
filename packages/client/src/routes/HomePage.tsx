import { useState, useEffect, useRef } from 'react'
import { Outlet, useSearchParams } from 'react-router'

import { log } from '../utils/logging';
import { ApiSearchResultHit, EpisodeManifest, SearchResponse } from '@listen-fair-play/types'

import '../App.css'
import { S3_HOSTED_FILES_BASE_URL } from '../constants';

import AppHeader from '../components/AppHeader'
import SearchInput from '../components/SearchInput'
import SearchResults from '../components/SearchResults'
import { performSearch, performHealthCheck } from '../utils/search'
import { SortOption } from '../types/search'

// Get the search API URL from environment variable, fallback to localhost for development
const SEARCH_API_BASE_URL = import.meta.env.VITE_SEARCH_API_URL || 'http://localhost:3001';

console.log('log level is:', log.getLevel());

const SEARCH_LIMIT = 50;

// Estimated time for Lambda cold start - if more than this time has passed since page load,
// we won't show the ColdStartLoader and will just use normal loading states
const ESTIMATED_TIME_FOR_LAMBDA_COLD_START = 10000; // 10 seconds

/**
 * HomePage component that orchestrates the search functionality for the Football Clichés transcript search.
 * 
 * Manages:
 * - Search state and API calls triggered by Enter key or button click
 * - Episode manifest fetching and filtering
 * - Scroll detection for header effects
 * - Coordination between child components
 * - Renders Outlet for child routes (episode sheet overlay)
 */
function HomePage() {
  log.info('[HomePage.tsx] HomePage component rendering/re-rendering');
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL-driven state - read from search params
  const searchQuery = searchParams.get('q') || '';
  const sortOption = (searchParams.get('sort') as SortOption) || 'relevance';

  // Local component state
  const [searchResults, setSearchResults] = useState<ApiSearchResultHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [episodeManifest, setEpisodeManifest] = useState<EpisodeManifest | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number>(0);
  const [isLambdaWarm, setIsLambdaWarm] = useState(false);
  const [showColdStartLoader, setShowColdStartLoader] = useState(false);
  const [mostRecentSuccessfulSearchQuery, setMostRecentSuccessfulSearchQuery] = useState<string | null>(null);

  // Local state for search input (not synced to URL until search is performed)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Ref to track if health check has been initiated to prevent multiple calls
  const healthCheckInitiated = useRef(false);
  // Ref to track when the page was loaded for cold start timeout logic
  const pageLoadTime = useRef(Date.now());
  // Ref to track the last search parameters to prevent duplicate searches
  const lastSearchParams = useRef<{query: string, sort: SortOption} | null>(null);

  // Sync local search query when URL changes (browser back/forward, direct navigation)
  useEffect(() => {
    log.info('[HomePage.tsx] useEffect [searchQuery] (URL sync): searchQuery changed to:', searchQuery, 'updating localSearchQuery from:', localSearchQuery, 'to:', searchQuery);
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // URL update functions
  const updateSearchQuery = (query: string) => {
    log.info('[HomePage.tsx] updateSearchQuery called: updating localSearchQuery from:', localSearchQuery, 'to:', query);
    setLocalSearchQuery(query);
  };

  const updateSortOption = (sort: SortOption) => {
    log.info('[HomePage.tsx] updateSortOption called: updating sort from:', sortOption, 'to:', sort);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (sort !== 'relevance') {
        newParams.set('sort', sort);
      } else {
        newParams.delete('sort');
      }
      return newParams;
    });
  };

  /**
   * Handle scroll detection for header visual effects
   */
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrolled]);

  /**
   * Fetch episode manifest on component mount for episode filtering functionality
   */
  useEffect(() => {
    const fetchEpisodeManifest = async () => {
      try {
        const manifestPath = `${S3_HOSTED_FILES_BASE_URL}episode-manifest/full-episode-manifest.json`;
        const response = await fetch(manifestPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch episode manifest: ${response.status}`);
        }
        const manifestData = await response.json();
        setEpisodeManifest(manifestData);
      } catch (e: any) {
        log.error('[HomePage.tsx] Failed to fetch episode manifest:', e);
        // Don't set error state to avoid blocking the main UI functionality
      }
    };

    fetchEpisodeManifest();
  }, []);

  /**
   * Perform health check on app initialization to warm up the Lambda
   */
  useEffect(() => {
    if (healthCheckInitiated.current) {
      return;
    }

    const performLambdaHealthCheck = async () => {
      healthCheckInitiated.current = true;
      
      try {
        log.info('[HomePage.tsx] Initiating Lambda health check to warm up search...');
        await performHealthCheck(SEARCH_API_BASE_URL);
        setIsLambdaWarm(true);
        log.info('[HomePage.tsx] Lambda health check completed - Lambda is now warm');
      } catch (e: any) {
        log.warn('[HomePage.tsx] Lambda health check failed, but continuing normally:', e);
        // Set as warm anyway to prevent blocking search functionality
        setIsLambdaWarm(true);
      }
    };

    performLambdaHealthCheck();
  }, []);

  /**
   * Perform search when explicitly triggered by user (Enter key or button click)
   */
  const handleSearch = async () => {
    const trimmedQuery = localSearchQuery.trim();
    log.info('[HomePage.tsx] handleSearch called with query:', trimmedQuery);

    // Clear results if query is too short
    if (trimmedQuery.length < 2) {
      log.info('[HomePage.tsx] handleSearch: Query too short, clearing results');
      setSearchResults([]);
      setError(null);
      setTotalHits(0);
      setProcessingTimeMs(0);
      setMostRecentSuccessfulSearchQuery(null);
      setShowColdStartLoader(false);
      
      // Update URL to clear search
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('q');
        return newParams;
      });
      return;
    }

    log.info('[HomePage.tsx] handleSearch: Updating URL with search query:', trimmedQuery);
    // Update URL with the search query
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('q', trimmedQuery);
      return newParams;
    });

    // Check if we should show cold start loader
    const timeSincePageLoad = Date.now() - pageLoadTime.current;
    const shouldShowColdStart = !isLambdaWarm && timeSincePageLoad < ESTIMATED_TIME_FOR_LAMBDA_COLD_START;
    
    if (shouldShowColdStart) {
      log.info('[HomePage.tsx] handleSearch: Showing cold start loader - Lambda not yet warm');
      setShowColdStartLoader(true);
      // Don't proceed with search until Lambda is warm
      return;
    }

    log.info('[HomePage.tsx] handleSearch: Proceeding with search request');
    // Perform the search
    await performSearchRequest(trimmedQuery);
  };

  /**
   * Perform the actual search API request
   */
  const performSearchRequest = async (query: string) => {
    // Check if we're about to perform the same search as last time
    const currentSearchParams = { query, sort: sortOption };
    const lastParams = lastSearchParams.current;
    
    if (lastParams && 
        lastParams.query === currentSearchParams.query && 
        lastParams.sort === currentSearchParams.sort) {
      log.info('[HomePage.tsx] performSearchRequest: Skipping duplicate search with same parameters:', currentSearchParams);
      return;
    }

    log.info('[HomePage.tsx] performSearchRequest called with query:', query, 'sortOption:', sortOption);
    
    // Update the last search params before starting the search
    lastSearchParams.current = currentSearchParams;
    
    setIsLoading(true);
    setError(null);

    try {
      const data: SearchResponse = await performSearch({
        query,
        sortOption,
        searchApiBaseUrl: SEARCH_API_BASE_URL,
        searchLimit: SEARCH_LIMIT,
      });
      
      if (data && data.hits) {
        log.info('[HomePage.tsx] performSearchRequest: Search successful, got', data.hits.length, 'results out of', data.totalHits, 'total hits');
        setSearchResults(data.hits);
        setTotalHits(data.totalHits || 0);
        setProcessingTimeMs(data.processingTimeMs || 0);
        setMostRecentSuccessfulSearchQuery(query);
      } else {
        log.warn('[HomePage.tsx] performSearchRequest: API response did not contain .hits array or was empty:', data);
        setSearchResults([]);
        setTotalHits(0);
        setProcessingTimeMs(0);
        setMostRecentSuccessfulSearchQuery(null);
      }
      
      // Hide cold start loader once we have real search results
      setShowColdStartLoader(false);
    } catch (e: any) {
      log.error('[HomePage.tsx] performSearchRequest: Failed to fetch search results:', e);
      setError(e.message || 'Failed to fetch search results. Please try again.');
      setSearchResults([]);
      setTotalHits(0);
      setProcessingTimeMs(0);
      // Hide cold start loader on error too
      setShowColdStartLoader(false);
      // Reset last search params on error so retry is possible
      lastSearchParams.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Trigger search when Lambda becomes warm and user has a pending search
   */
  useEffect(() => {
    const trimmedQuery = localSearchQuery.trim();
    log.info('[HomePage.tsx] useEffect [isLambdaWarm, showColdStartLoader, localSearchQuery, sortOption]: isLambdaWarm:', isLambdaWarm, 'showColdStartLoader:', showColdStartLoader, 'trimmedQuery:', trimmedQuery);
    
    // If Lambda just became warm and user has a valid search query showing cold start loader, perform the search
    if (isLambdaWarm && trimmedQuery.length >= 2 && showColdStartLoader) {
      log.info('[HomePage.tsx] Lambda is now warm - performing pending search with query:', trimmedQuery);
      performSearchRequest(trimmedQuery);
    }
  }, [isLambdaWarm, showColdStartLoader, localSearchQuery, sortOption]);

  /**
   * Hide cold start loader when Lambda becomes warm (if no search is needed)
   */
  useEffect(() => {
    const trimmedQuery = localSearchQuery.trim();
    log.info('[HomePage.tsx] useEffect [isLambdaWarm, showColdStartLoader, localSearchQuery] (hide cold start): isLambdaWarm:', isLambdaWarm, 'showColdStartLoader:', showColdStartLoader, 'trimmedQuery:', trimmedQuery);
    
    if (isLambdaWarm && showColdStartLoader && trimmedQuery.length < 2) {
      log.info('[HomePage.tsx] Lambda is now warm but no valid search query - hiding cold start loader');
      setShowColdStartLoader(false);
    }
  }, [isLambdaWarm, showColdStartLoader, localSearchQuery]);

  /**
   * Re-run search when sort option changes (but only if we have an active search)
   */
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    log.info('[HomePage.tsx] useEffect [sortOption]: sortOption:', sortOption, 'searchQuery:', searchQuery, 'trimmedQuery:', trimmedQuery);
    
    if (trimmedQuery.length >= 2) {
      log.info('[HomePage.tsx] Re-running search due to sort change with query:', trimmedQuery);
      performSearchRequest(trimmedQuery);
    } else {
      log.info('[HomePage.tsx] Not re-running search - query too short or empty');
    }
  }, [sortOption]);

  return (
    <div className="bg-background max-w-3xl mx-auto p-4 font-mono pt-28 min-h-screen">
      <AppHeader scrolled={scrolled} />

      <SearchInput
        value={localSearchQuery}
        onChange={updateSearchQuery}
        onSearch={handleSearch}
        isLoading={isLoading}
        mostRecentSuccessfulSearchQuery={mostRecentSuccessfulSearchQuery}
      />

      {/* Conditionally render ColdStartLoader or SearchResults */}
      {showColdStartLoader ? (
        <div className="p-4 bg-gray-100 animate-pulse rounded text-center">
          <p>Initializing search...</p>
          <br/>
          <p>Subsequent searches will be much faster</p>
        </div>
      ) : (
        <SearchResults
          results={searchResults}
          isLoading={isLoading}
          error={error}
          searchQuery={searchQuery}
          mostRecentSuccessfulSearchQuery={mostRecentSuccessfulSearchQuery}
          totalHits={totalHits}
          processingTimeMs={processingTimeMs}
          episodeManifest={episodeManifest}
          sortOption={sortOption}
          onSortChange={updateSortOption}
        />
      )}

      {/* Outlet for child routes - episode sheet overlay */}
      <Outlet />
    </div>
  )
}

export default HomePage 