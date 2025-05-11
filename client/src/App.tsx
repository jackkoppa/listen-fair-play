import { useState, useEffect } from 'react'
import fuzzysort from 'fuzzysort'
import './App.css'

import { log } from '@listen-fair-play/utils';

// Import the parse transcript content function
import parseTranscriptContent from './utils/parseTranscriptContent'

// Import SearchResult component
import SearchResult, { TranscriptEntry } from './components/SearchResult'

// Define search result interface with score
interface SearchResultWithContext {
  result: TranscriptEntry;
  score: number;
  previousLine: TranscriptEntry | null;
  nextLine: TranscriptEntry | null;
}

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultWithContext[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load transcript files on component mount
  useEffect(() => {
    const loadTranscripts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let allTranscripts: TranscriptEntry[] = [];
        
        // Check if we're in production (deployed) or development environment
        const isProd = import.meta.env.PROD;
        
        if (isProd) {
          try {
            // In production, fetch transcripts from the deployed assets directory
            const response = await fetch('/assets/transcripts/index.json');
            if (!response.ok) {
              throw new Error(`Failed to fetch transcript index: ${response.status}`);
            }
            
            const transcriptIndex = await response.json();
            
            // Load each transcript file
            for (const fileName of transcriptIndex.files) {
              const fileResponse = await fetch(`/assets/transcripts/${fileName}`);
              if (!fileResponse.ok) {
                log.error(`Failed to fetch transcript: ${fileName}`);
                continue;
              }
              
              const content = await fileResponse.text();
              const parsedEntries = parseTranscriptContent(content, fileName);
              allTranscripts = [...allTranscripts, ...parsedEntries];
            }
          } catch (fetchError) {
            log.error('Error fetching transcripts:', fetchError);
            setError('Failed to load transcripts from server. Falling back to local transcripts.');
            
            // Fall back to locally loaded transcripts
            const localTranscripts = await loadLocalTranscripts();
            allTranscripts = [...allTranscripts, ...localTranscripts];
          }
        } else {
          // In development, load transcripts from /processing/transcripts
          const localTranscripts = await loadLocalTranscripts();
          allTranscripts = [...allTranscripts, ...localTranscripts];
        }
        
        setTranscripts(allTranscripts);
      } catch (error) {
        log.error('Error loading transcripts:', error);
        setError('Failed to load transcripts. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTranscripts();
  }, []);

  // Function to load transcripts from the processing directory during development
  const loadLocalTranscripts = async () => {
    let allTranscripts: TranscriptEntry[] = [];
    
    try {
      // In development, we need to fetch from the processing directory
      // First, get the list of transcript files
      const transcriptIndexResponse = await fetch('/api/transcript-files');
      
      if (!transcriptIndexResponse.ok) {
        throw new Error(`Failed to fetch transcript index: ${transcriptIndexResponse.status}`);
      }
      
      const transcriptFiles = await transcriptIndexResponse.json();
      // Load each transcript file
      for (const fileName of transcriptFiles.files) {
        try {
          const fileResponse = await fetch(`/api/transcripts/${fileName}`);
          if (!fileResponse.ok) {
            log.error(`Failed to fetch transcript: ${fileName}`);
            continue;
          }
          
          const content = await fileResponse.text();
          const parsedEntries = parseTranscriptContent(content, fileName);
          allTranscripts = [...allTranscripts, ...parsedEntries];
        } catch (error) {
          log.error(`Error loading transcript ${fileName}:`, error);
        }
      }
    } catch (error) {
      log.error('Error loading local transcripts:', error);
      setError('Failed to load local transcripts. Check the development server setup.');
      
      // If all else fails, use demo data
      return loadDemoTranscripts();
    }
    
    return allTranscripts;
  };
  
  // Function to load demo transcript data as a last resort
  const loadDemoTranscripts = () => {
    // Create some placeholder transcript entries for demo purposes
    const demoTranscripts: TranscriptEntry[] = [
      {
        id: 1,
        startTime: '00:00:10,000',
        endTime: '00:00:15,000',
        speaker: '[SPEAKER_1]:',
        text: 'This is a demo transcript entry.',
        fullText: '[SPEAKER_1]: This is a demo transcript entry.',
        fileName: 'demo-transcript.srt'
      },
      {
        id: 2,
        startTime: '00:00:16,000',
        endTime: '00:00:20,000',
        speaker: '[SPEAKER_2]:',
        text: 'Please ensure your development server is running correctly.',
        fullText: '[SPEAKER_2]: Please ensure your development server is running correctly.',
        fileName: 'demo-transcript.srt'
      }
    ];
    
    return demoTranscripts;
  };
  
  // Search through transcripts when query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    if (transcripts.length === 0) {
      return;
    }
    
    // Use fuzzysort to search through transcripts
    const results = fuzzysort.go(searchQuery, transcripts, {
      keys: ['text'],
      limit: 100,
      threshold: 0.75 // Lower threshold allows more fuzzy matches
    });
    
    // Map results to transcript entries with context and score
    const searchResultsWithContext = results.map(result => {
      const entry = result.obj;
      const entryIndex = transcripts.findIndex(t => 
        t.id === entry.id && t.fileName === entry.fileName
      );
      
      // Get previous and next lines if they exist
      const previousLine = entryIndex > 0 ? transcripts[entryIndex - 1] : null;
      const nextLine = entryIndex < transcripts.length - 1 ? transcripts[entryIndex + 1] : null;
      
      // Calculate score - take the first score from the key scores array
      // Higher scores are better in fuzzysort
      const score = result.score || -10000;
      
      return {
        result: entry,
        score,
        previousLine,
        nextLine
      };
    });
    
    setSearchResults(searchResultsWithContext);
  }, [searchQuery, transcripts]);

  return (
    <div className="app-container">
      <header>
        <h1>Football Cliches Transcript Search</h1>
        <p>Search through podcast transcripts by typing below</p>
      </header>
      
      <div className="search-container">
        <input
          type="text"
          placeholder="Search transcripts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="results-container">
        {isLoading ? (
          <p className="loading-message">Loading transcripts...</p>
        ) : searchResults.length > 0 ? (
          <ul className="results-list">
            {searchResults.map((resultWithContext, index) => (
              <SearchResult 
                key={index}
                result={resultWithContext.result}
                score={resultWithContext.score}
                previousLine={resultWithContext.previousLine}
                nextLine={resultWithContext.nextLine}
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
