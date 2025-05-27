import { useState, useEffect, useMemo, useRef } from 'react'
import { Outlet, useSearchParams } from 'react-router'

import { log } from '@listen-fair-play/logging';
import { ApiSearchResultHit, EpisodeManifest, SearchResponse } from '@listen-fair-play/types'

import '../App.css'
import { S3_HOSTED_FILES_BASE_URL } from '../constants';

import AppHeader from '../components/AppHeader'
import SearchControls, { SortOption } from '../components/SearchControls'
import SearchInput from '../components/SearchInput'
import SearchResults from '../components/SearchResults'
import ColdStartLoader from '../components/ColdStartLoader'
import { performSearch, performHealthCheck } from '../utils/search'

// Get the search API URL from environment variable, fallback to localhost for development
const SEARCH_API_BASE_URL = import.meta.env.VITE_SEARCH_API_URL || 'http://localhost:3001';

const SEARCH_LIMIT = 50;

const SEARCH_DEBOUNCE_MS = 150;

/**
 * HomePage component that orchestrates the search functionality for the Football Clichés transcript search.
 * 
 * Manages:
 * - Search state and API calls with debouncing
 * - Episode manifest fetching and filtering
 * - Scroll detection for header effects
 * - Coordination between child components
 * - Renders Outlet for child routes (episode sheet overlay)
 */
function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL-driven state - read from search params
  const searchQuery = searchParams.get('q') || '';
  const sortOption = (searchParams.get('sort') as SortOption) || 'relevance';
  const selectedEpisodeIds = useMemo(() => {
    const episodesParam = searchParams.get('episodes');
    return episodesParam 
      ? episodesParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : [];
  }, [searchParams]);

  // Local component state
  const [searchResults, setSearchResults] = useState<ApiSearchResultHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [episodeManifest, setEpisodeManifest] = useState<EpisodeManifest | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showEpisodeFilter, setShowEpisodeFilter] = useState(false);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number>(0);
  const [isLambdaWarm, setIsLambdaWarm] = useState(false);
  const [showColdStartLoader, setShowColdStartLoader] = useState(false);

  // Local state for immediate search input updates (before URL sync)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Ref to track if health check has been initiated to prevent multiple calls
  const healthCheckInitiated = useRef(false);

  // Sync local search query when URL changes (browser back/forward, direct navigation)
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // URL update functions
  const updateSearchQuery = (query: string) => {
    setLocalSearchQuery(query);
    // Debounced URL update will happen in useEffect
  };

  // Debounced URL update for search query
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        if (localSearchQuery.trim()) {
          newParams.set('q', localSearchQuery);
        } else {
          newParams.delete('q');
        }
        return newParams;
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(debounceTimer);
  }, [localSearchQuery]);

  const updateSortOption = (sort: SortOption) => {
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

  const updateSelectedEpisodeIds = (episodeIds: number[]) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (episodeIds.length > 0) {
        newParams.set('episodes', episodeIds.join(','));
      } else {
        newParams.delete('episodes');
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
   * Handle search API calls with debouncing and proper error handling
   */
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setError(null);
      setTotalHits(0);
      setProcessingTimeMs(0);
      setShowColdStartLoader(false);
      return;
    }

    // Show cold start loader if Lambda isn't warm and user is trying to search
    if (!isLambdaWarm && trimmedQuery.length >= 2) {
      setShowColdStartLoader(true);
      log.info('[HomePage.tsx] Showing cold start loader - Lambda not yet warm');
      // Don't proceed with search until Lambda is warm
      return;
    }

    const fetchSearchResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data: SearchResponse = await performSearch({
          query: trimmedQuery,
          sortOption,
          selectedEpisodeIds,
          searchApiBaseUrl: SEARCH_API_BASE_URL,
          searchLimit: SEARCH_LIMIT,
        });
        
        if (data && data.hits) {
          setSearchResults(data.hits);
          setTotalHits(data.totalHits || 0);
          setProcessingTimeMs(data.processingTimeMs || 0);
        } else {
          setSearchResults([]);
          setTotalHits(0);
          setProcessingTimeMs(0);
          log.warn('[HomePage.tsx] API response did not contain .hits array or was empty:', data);
        }
        
        // Hide cold start loader once we have real search results
        setShowColdStartLoader(false);
      } catch (e: any) {
        log.error('[HomePage.tsx] Failed to fetch search results:', e);
        setError(e.message || 'Failed to fetch search results. Please try again.');
        setSearchResults([]);
        setTotalHits(0);
        setProcessingTimeMs(0);
        // Hide cold start loader on error too
        setShowColdStartLoader(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSearchResults();
    }, 500);

    return () => clearTimeout(debounceTimer);

  }, [searchQuery, sortOption, selectedEpisodeIds, isLambdaWarm]); 

  /**
   * Trigger search when Lambda becomes warm and user has a pending search
   */
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    
    // If Lambda just became warm and user has a valid search query, perform the search
    if (isLambdaWarm && trimmedQuery.length >= 2 && showColdStartLoader) {
      log.info('[HomePage.tsx] Lambda is now warm - performing pending search');
      
      const fetchSearchResults = async () => {
        setIsLoading(true);
        setError(null);

        try {
          const data: SearchResponse = await performSearch({
            query: trimmedQuery,
            sortOption,
            selectedEpisodeIds,
            searchApiBaseUrl: SEARCH_API_BASE_URL,
            searchLimit: SEARCH_LIMIT,
          });
          
          if (data && data.hits) {
            setSearchResults(data.hits);
            setTotalHits(data.totalHits || 0);
            setProcessingTimeMs(data.processingTimeMs || 0);
          } else {
            setSearchResults([]);
            setTotalHits(0);
            setProcessingTimeMs(0);
            log.warn('[HomePage.tsx] API response did not contain .hits array or was empty:', data);
          }
          
          // Hide cold start loader once we have real search results
          setShowColdStartLoader(false);
        } catch (e: any) {
          log.error('[HomePage.tsx] Failed to fetch search results:', e);
          setError(e.message || 'Failed to fetch search results. Please try again.');
          setSearchResults([]);
          setTotalHits(0);
          setProcessingTimeMs(0);
          // Hide cold start loader on error too
          setShowColdStartLoader(false);
        } finally {
          setIsLoading(false);
        }
      };

      fetchSearchResults();
    }
  }, [isLambdaWarm, showColdStartLoader, searchQuery, sortOption, selectedEpisodeIds]);

  /**
   * Hide cold start loader when Lambda becomes warm (if no search is needed)
   */
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    
    if (isLambdaWarm && showColdStartLoader && trimmedQuery.length < 2) {
      log.info('[HomePage.tsx] Lambda is now warm but no valid search query - hiding cold start loader');
      setShowColdStartLoader(false);
    }
  }, [isLambdaWarm, showColdStartLoader, searchQuery]);

  /**
   * Handle episode selection for filtering search results
   */
  const handleEpisodeSelection = (episodeId: number, isSelected: boolean) => {
    if (isSelected) {
      updateSelectedEpisodeIds([...selectedEpisodeIds, episodeId]);
    } else {
      updateSelectedEpisodeIds(selectedEpisodeIds.filter(id => id !== episodeId));
    }
  };

  /**
   * Clear all episode filters
   */
  const clearEpisodeFilters = () => {
    updateSelectedEpisodeIds([]);
  };

  // Get available episodes for filtering (sorted by date, newest first)
  const availableEpisodes = episodeManifest?.episodes
    .slice()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) || [];

  return (
    <div className="app-container max-w-3xl mx-auto p-4 font-mono pt-28">
      <AppHeader scrolled={scrolled} />

      {/* Header spacer */}
      <div className="d-block h-10"></div>

      <SearchInput
        value={localSearchQuery}
        onChange={updateSearchQuery}
        isLoading={isLoading}
      />

      <SearchControls
        searchQuery={searchQuery}
        selectedEpisodeIds={selectedEpisodeIds}
        onEpisodeSelection={handleEpisodeSelection}
        onClearEpisodeFilters={clearEpisodeFilters}
        availableEpisodes={availableEpisodes}
        showEpisodeFilter={showEpisodeFilter}
        onToggleEpisodeFilter={() => setShowEpisodeFilter(!showEpisodeFilter)}
      />

      {/* Conditionally render ColdStartLoader or SearchResults */}
      {showColdStartLoader ? (
        <ColdStartLoader 
          onComplete={() => {
            setShowColdStartLoader(false);
            log.info('[HomePage.tsx] Cold start loader manually dismissed');
          }}
        />
      ) : (
        <SearchResults
          results={searchResults}
          isLoading={isLoading}
          error={error}
          searchQuery={searchQuery}
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