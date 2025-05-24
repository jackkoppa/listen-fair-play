import { useState, useEffect } from 'react'

import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { log } from '@listen-fair-play/logging';
import { ApiSearchResultHit, EpisodeManifest, SearchRequest, SearchResponse } from '@listen-fair-play/types'

import './App.css'

import SearchResult from './components/SearchResult'

// Get the search API URL from environment variable, fallback to localhost for development
const SEARCH_API_BASE_URL = import.meta.env.VITE_SEARCH_API_URL || 'http://localhost:3001';

// Get the base URL for manifest files, fallback to local path for development
// CURSOR-TODO: Fix this, and package.json#scripts.temp-serve-s3-assets
// const MANIFEST_BASE_URL = ''; // for deployment
const MANIFEST_BASE_URL = 'http://127.0.0.1:8080'; // for local development

const SEARCH_LIMIT = 50;

type SortOption = 'relevance' | 'newest' | 'oldest';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiSearchResultHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [episodeManifest, setEpisodeManifest] = useState<EpisodeManifest | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('relevance');
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<number[]>([]);
  const [showEpisodeFilter, setShowEpisodeFilter] = useState(false);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number>(0);

  // TODO: Use this to hold off on rendering results as well
  const [_, setIsLoadingManifest] = useState(false);

  // Handle scroll effect
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

  // Fetch episode manifest on component mount
  useEffect(() => {
    const fetchEpisodeManifest = async () => {
      setIsLoadingManifest(true);
      try {
        const manifestPath = `${MANIFEST_BASE_URL}/episode-manifest/full-episode-manifest.json`;
        const response = await fetch(manifestPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch episode manifest: ${response.status}`);
        }
        const manifestData = await response.json();
        setEpisodeManifest(manifestData);
      } catch (e: any) {
        log.error('[App.tsx] Failed to fetch episode manifest:', e);
        // Don't set error state to avoid blocking the main UI functionality
      } finally {
        setIsLoadingManifest(false);
      }
    };

    fetchEpisodeManifest();
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setError(null);
      setTotalHits(0);
      setProcessingTimeMs(0);
      return;
    }

    const fetchSearchResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Prepare search request with new Orama parameters
        const searchRequest: SearchRequest = {
          query: trimmedQuery,
          limit: SEARCH_LIMIT,
          searchFields: ['text'], // Search only in transcript text
        };

        // Add sorting parameters based on sort option
        if (sortOption === 'newest') {
          searchRequest.sortBy = 'episodePublishedUnixTimestamp';
          searchRequest.sortOrder = 'desc';
        } else if (sortOption === 'oldest') {
          searchRequest.sortBy = 'episodePublishedUnixTimestamp';
          searchRequest.sortOrder = 'asc';
        }
        // For 'relevance', we don't add sortBy/sortOrder to use Orama's default relevance scoring

        // Add episode filtering if episodes are selected
        if (selectedEpisodeIds.length > 0) {
          searchRequest.episodeIds = selectedEpisodeIds;
        }

        // Make API request using POST for complex search parameters
        const response = await fetch(`${SEARCH_API_BASE_URL}/`, {
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
        
        if (data && data.hits) {
          setSearchResults(data.hits);
          setTotalHits(data.totalHits || 0);
          setProcessingTimeMs(data.processingTimeMs || 0);
        } else {
          setSearchResults([]);
          setTotalHits(0);
          setProcessingTimeMs(0);
          log.warn('[App.tsx] API response did not contain .hits array or was empty:', data);
        }
      } catch (e: any) {
        log.error('[App.tsx] Failed to fetch search results:', e);
        setError(e.message || 'Failed to fetch search results. Please try again.');
        setSearchResults([]);
        setTotalHits(0);
        setProcessingTimeMs(0);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSearchResults();
    }, 300);

    return () => clearTimeout(debounceTimer);

  }, [searchQuery, sortOption, selectedEpisodeIds]); 

  const handleEpisodeSelection = (episodeId: number, isSelected: boolean) => {
    if (isSelected) {
      setSelectedEpisodeIds(prev => [...prev, episodeId]);
    } else {
      setSelectedEpisodeIds(prev => prev.filter(id => id !== episodeId));
    }
  };

  const clearEpisodeFilters = () => {
    setSelectedEpisodeIds([]);
  };

  // Get available episodes for filtering (sorted by date, newest first)
  const availableEpisodes = episodeManifest?.episodes
    .slice()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) || [];

  return (
    <div className="app-container max-w-3xl mx-auto p-4 font-mono pt-28">
      <header className={`fixed top-0 left-0 right-0 z-10 bg-secondary border-b-2 border-black shadow-[0px_4px_0px_rgba(0,0,0,1)] transition-all duration-300 ease-in-out ${scrolled ? 'py-2' : 'py-4'}`}>
        <div className="max-w-3xl mx-auto px-6 text-right">
          <h1 className={`font-bold text-black transition-all duration-200 ${scrolled ? 'text-2xl mb-0' : 'text-3xl mb-1'}`}>Listen, Fair Play</h1>
          <p className={`text-sm text-black italic transition-all duration-200 ${scrolled ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>search the Football Clichés record books</p>
        </div>
      </header>

      {/* Header spacer */}
      <div className="d-block h-10"></div>

      <div className="search-input-container mb-8 relative flex items-center">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
        <input
          type="text"
          placeholder="Search transcripts (min. 2 characters)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input w-full p-3 pl-10 border-black border-2 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none"
        />
        {isLoading && (
          <div className="search-spinner absolute right-3 top-1/2 transform -translate-y-1/2 border-t-transparent border-solid animate-spin rounded-full border-blue-500 border-4 h-6 w-6"></div>
        )}
      </div>

      {/* Search Controls */}
      {searchQuery.trim().length >= 2 && (
        <div className="search-controls mb-6 p-4 bg-gray-50 border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold">Sort by:</label>
              <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
                <SelectTrigger className="w-32 border-black border-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none">
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Episode Filter Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEpisodeFilter(!showEpisodeFilter)}
                className="border-black border-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] rounded-none"
              >
                Filter Episodes ({selectedEpisodeIds.length})
              </Button>
              {selectedEpisodeIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearEpisodeFilters}
                  className="text-red-600 hover:text-red-800"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Episode Selection */}
          {showEpisodeFilter && (
            <div className="mt-4 p-3 bg-white border-2 border-gray-300 rounded-none max-h-60 overflow-y-auto">
              <p className="text-sm font-semibold mb-2">Select episodes to search within:</p>
              <div className="space-y-1">
                {availableEpisodes.map((episode) => (
                  <label key={episode.sequentialId} className="flex items-center gap-2 text-sm hover:bg-gray-50 p-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEpisodeIds.includes(episode.sequentialId)}
                      onChange={(e) => handleEpisodeSelection(episode.sequentialId, e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="truncate">{episode.title}</span>
                    <span className="text-xs text-gray-500 ml-auto">{new Date(episode.publishedAt).getFullYear()}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-message text-red-600 bg-red-100 border-red-600 border-2 p-4 mb-6 shadow-[4px_4px_0px_#ef4444] rounded-none">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      <div className="results-container">
        {isLoading && !error ? (
          <p className="loading-message text-lg text-gray-600 text-center">Loading results...</p>
        ) : searchResults.length > 0 ? (
          <>
          <div className="results-info text-sm mb-4 text-right flex justify-between items-center">
            <span className="text-gray-600">
              {processingTimeMs > 0 && <em>Search time: {processingTimeMs}ms</em>}
            </span>
            <span>
              <em>Showing:</em> <span className="font-bold text-black">{searchResults.length}</span>
              {totalHits !== searchResults.length && (
                <> <em>of</em> <span className="font-bold text-black">{totalHits}</span></>
              )}
              <> <em>hits</em></>
            </span>
          </div>
          <ul className="results-list space-y-6">
            {searchResults.map((result) => (
              <SearchResult
                key={result.id}
                result={result}
                episodeData={episodeManifest?.episodes.find(ep => ep.sequentialId === parseInt(result.sequentialEpisodeIdAsString))}
              />
            ))}
          </ul>
          </>
        ) : searchQuery.trim().length >= 2 && !error ? (
          <p className="no-results text-lg text-gray-600 text-center bg-gray-100 p-6 border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none">
            No results found for "{searchQuery}". Try a different term, perhaps something more pedantic?
          </p>
        ) : null}
      </div>

      {/* Removed Test Button */}
    </div>
  )
}

export default App
