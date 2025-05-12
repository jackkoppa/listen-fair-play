import { useState, useEffect } from 'react'
import './App.css'

import { log } from '@listen-fair-play/utils';

import SearchResult from './components/SearchResult'

export interface ApiSearchResultHit {
  id: string;
  episodeId: number;
  episodeTitle: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  highlight: string;
}

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
      
      const SEARCH_API_BASE_URL = 'http://localhost:3001';
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
    <div className="app-container">
      <header>
        <h1>Football Cliches Transcript Search</h1>
        <p>Search through podcast transcripts by typing below</p>
      </header>
      
      <div className="search-input-container"> 
        <input
          type="text"
          placeholder="Search transcripts (min. 2 characters)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {isLoading && <div className="search-spinner"></div>}
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="results-container">
        {isLoading ? (
          <p className="loading-message">Loading results...</p>
        ) : searchResults.length > 0 ? (
          <ul className="results-list">
            {searchResults.map((result) => (
              <SearchResult 
                key={result.id}
                result={result}
              />
            ))}
          </ul>
        ) : searchQuery.trim().length >=2 && !error ? (
          <p className="no-results">No results found for "{searchQuery}"</p>
        ) : null}
      </div>
    </div>
  )
}

export default App
