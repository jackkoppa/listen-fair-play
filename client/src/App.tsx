import { useState, useEffect } from 'react'
// import fuzzysort from 'fuzzysort' // Not needed anymore
import './App.css'

import { log } from '@listen-fair-play/utils';

// Import the parse transcript content function
// import parseTranscriptContent from './utils/parseTranscriptContent' // This file was deleted

// Import SearchResult component
import SearchResult from './components/SearchResult'

// Define the structure for a single search hit from the API
export interface ApiSearchResultHit {
  id: string;
  episodeId: number;
  episodeTitle: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  highlight: string; // This contains HTML with <b> tags for highlighting
}

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiSearchResultHit[]>([]);
  const [isLoading, setIsLoading] = useState(false); // For API loading state
  const [error, setError] = useState<string | null>(null); // For API errors

  // Load transcript files on component mount
  // useEffect(() => {
  //   const loadTranscripts = async () => {
  //     setIsLoading(true);
  //     setError(null);
  //     try {
  //       let allTranscripts: TranscriptEntry[] = [];
        
  //       // Check if we're in production (deployed) or development environment
  //       const isProd = import.meta.env.PROD;
        
  //       if (isProd) {
  //         try {
  //           // In production, fetch transcripts from the deployed assets directory
  //           const response = await fetch('/assets/transcripts/index.json');
  //           if (!response.ok) {
  //             throw new Error(`Failed to fetch transcript index: ${response.status}`);
  //           }
            
  //           const transcriptIndex = await response.json();
            
  //           // Load each transcript file
  //           for (const fileName of transcriptIndex.files) {
  //             const fileResponse = await fetch(`/assets/transcripts/${fileName}`);
  //             if (!fileResponse.ok) {
  //               log.error(`Failed to fetch transcript: ${fileName}`);
  //               continue;
  //             }
              
  //             const content = await fileResponse.text();
  //             const parsedEntries = parseTranscriptContent(content, fileName);
  //             allTranscripts = [...allTranscripts, ...parsedEntries];
  //           }
  //         } catch (fetchError) {
  //           log.error('Error fetching transcripts:', fetchError);
  //           setError('Failed to load transcripts from server. Falling back to local transcripts.');
            
  //           // Fall back to locally loaded transcripts
  //           const localTranscripts = await loadLocalTranscripts();
  //           allTranscripts = [...allTranscripts, ...localTranscripts];
  //         }
  //       } else {
  //         // In development, load transcripts from /processing/transcripts
  //         const localTranscripts = await loadLocalTranscripts();
  //         allTranscripts = [...allTranscripts, ...localTranscripts];
  //       }
        
  //       setTranscripts(allTranscripts);
  //     } catch (error) {
  //       log.error('Error loading transcripts:', error);
  //       setError('Failed to load transcripts. Please try again later.');
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };
    
  //   loadTranscripts();
  // }, []);

  // Function to load transcripts from the processing directory during development
  // const loadLocalTranscripts = async () => {
  //   let allTranscripts: TranscriptEntry[] = [];
    
  //   try {
  //     // In development, we need to fetch from the processing directory
  //     // First, get the list of transcript files
  //     const transcriptIndexResponse = await fetch('/api/transcript-files');
      
  //     if (!transcriptIndexResponse.ok) {
  //       throw new Error(`Failed to fetch transcript index: ${transcriptIndexResponse.status}`);
  //     }
      
  //     const transcriptFiles = await transcriptIndexResponse.json();
  //     // Load each transcript file
  //     for (const fileName of transcriptFiles.files) {
  //       try {
  //         const fileResponse = await fetch(`/api/transcripts/${fileName}`);
  //         if (!fileResponse.ok) {
  //           log.error(`Failed to fetch transcript: ${fileName}`);
  //           continue;
  //         }
          
  //         const content = await fileResponse.text();
  //         const parsedEntries = parseTranscriptContent(content, fileName);
  //         allTranscripts = [...allTranscripts, ...parsedEntries];
  //       } catch (error) {
  //         log.error(`Error loading transcript ${fileName}:`, error);
  //       }
  //     }
  //   } catch (error) {
  //     log.error('Error loading local transcripts:', error);
  //     setError('Failed to load local transcripts. Check the development server setup.');
      
  //     // If all else fails, use demo data
  //     return loadDemoTranscripts();
  //   }
    
  //   return allTranscripts;
  // };
  
  // Function to load demo transcript data as a last resort
  // const loadDemoTranscripts = () => {
  //   // Create some placeholder transcript entries for demo purposes
  //   const demoTranscripts: TranscriptEntry[] = [
  //     {
  //       id: 1,
  //       startTime: '00:00:10,000',
  //       endTime: '00:00:15,000',
  //       speaker: '[SPEAKER_1]:',
  //       text: 'This is a demo transcript entry.',
  //       fullText: '[SPEAKER_1]: This is a demo transcript entry.',
  //       fileName: 'demo-transcript.srt'
  //     },
  //     {
  //       id: 2,
  //       startTime: '00:00:16,000',
  //       endTime: '00:00:20,000',
  //       speaker: '[SPEAKER_2]:',
  //       text: 'Please ensure your development server is running correctly.',
  //       fullText: '[SPEAKER_2]: Please ensure your development server is running correctly.',
  //       fileName: 'demo-transcript.srt'
  //     }
  //   ];
    
  //   return demoTranscripts;
  // };
  
  // Search through transcripts when query changes
  useEffect(() => {
    // Prevent new request if one is already in progress
    if (isLoading) {
      return;
    }

    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setError(null); // Clear previous errors if query is too short
      return;
    }

    const fetchSearchResults = async () => {
      setIsLoading(true);
      setError(null);
      
      // Determine API base URL based on environment
      const isDev = import.meta.env.DEV;
      // const SEARCH_API_BASE_URL = isDev ? 'http://localhost:3001' : 'DOMAIN_NAME_TBD'; // Using placeholder for prod
      // For now, always use localhost:3001, as per instructions
      const SEARCH_API_BASE_URL = 'http://localhost:3001';
      const limit = 10; // Or make this configurable

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
        setSearchResults([]); // Clear results on error
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the search or use a more sophisticated approach if needed
    const debounceTimer = setTimeout(() => {
      fetchSearchResults();
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(debounceTimer); // Cleanup timer on unmount or if query changes again

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
                key={result.id} // Use a unique key from the data, like hit.id
                result={result}
              />
            ))}
          </ul>
        ) : searchQuery.trim() !== '' ? (
          <p className="no-results">No results found for "{searchQuery}"</p>
        ) : null}
      </div>
    </div>
  )
}

export default App
