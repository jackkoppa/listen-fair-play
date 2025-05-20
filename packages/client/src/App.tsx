import { useState, useEffect } from 'react'

// import { Button } from "@/components/ui/button" // No longer using Button here

import { log } from '@listen-fair-play/logging';
import { ApiSearchResultHit } from '@listen-fair-play/types'

import './App.css'

import SearchResult from './components/SearchResult'

// Get the search API URL from environment variable, fallback to localhost for development
const SEARCH_API_BASE_URL = import.meta.env.VITE_SEARCH_API_URL || 'http://localhost:3001';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiSearchResultHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setError(null);
      return;
    }

    const fetchSearchResults = async () => {
      setIsLoading(true);
      setError(null);
      
      const limit = 10;

      try {
        const response = await fetch(`${SEARCH_API_BASE_URL}/?query=${encodeURIComponent(trimmedQuery)}&limit=${limit}`);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();
        if (data && data.hits) {
          setSearchResults(data.hits);
        } else {
          setSearchResults([]);
          log.warn('[App.tsx] API response did not contain .hits array or was empty:', data);
        }
      } catch (e: any) {
        log.error('[App.tsx] Failed to fetch search results:', e);
        setError(e.message || 'Failed to fetch search results. Please try again.');
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSearchResults();
    }, 300);

    return () => clearTimeout(debounceTimer);

  }, [searchQuery]);

  return (
    <div className="app-container max-w-3xl mx-auto p-4 font-mono pt-28">
      <header className="fixed top-0 left-0 right-0 z-10 bg-secondary border-b-2 border-black shadow-[0px_4px_0px_rgba(0,0,0,1)]">
        <div className="max-w-3xl mx-auto p-6 text-center">
          <h1 className="text-3xl font-bold mb-1 text-black">Listen, Fair Play</h1>
          <p className="text-sm text-black italic">search the Football Clichés record books</p>
        </div>
      </header>

      {/* Header spacer */}
      <div className="d-block h-10"></div>

      <div className="search-input-container mb-8 relative flex items-center">
        <input
          type="text"
          placeholder="Search transcripts (min. 2 characters)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input w-full p-3 border-black border-2 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none"
        />
        {isLoading && (
          <div className="search-spinner absolute right-3 top-1/2 transform -translate-y-1/2 border-t-transparent border-solid animate-spin rounded-full border-blue-500 border-4 h-6 w-6"></div>
        )}
      </div>

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
          <ul className="results-list space-y-6">
            {searchResults.map((result) => (
              <SearchResult
                key={result.id}
                result={result}
              />
            ))}
          </ul>
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
