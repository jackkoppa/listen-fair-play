import { ApiSearchResultHit, EpisodeManifest } from '@listen-fair-play/types'
import SearchResult from './SearchResult'

interface SearchResultsProps {
  results: ApiSearchResultHit[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  totalHits: number;
  processingTimeMs: number;
  episodeManifest: EpisodeManifest | null;
}

export default function SearchResults({
  results,
  isLoading,
  error,
  searchQuery,
  totalHits,
  processingTimeMs,
  episodeManifest,
}: SearchResultsProps) {
  // Show error message if there's an error
  if (error) {
    return (
      <div className="error-message text-red-600 bg-red-100 border-red-600 border-2 p-4 mb-6 shadow-[4px_4px_0px_#ef4444] rounded-none">
        <p className="font-semibold">Error:</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="results-container">
      {isLoading && !error ? (
        <p className="loading-message text-lg text-gray-600 text-center">Loading results...</p>
      ) : results.length > 0 ? (
        <>
          <div className="results-info text-sm mb-4 text-right flex justify-between items-center">
            <span className="text-gray-600">
              {processingTimeMs > 0 && <em>Search time: {processingTimeMs}ms</em>}
            </span>
            <span>
              <em>Showing:</em> <span className="font-bold text-black">{results.length}</span>
              {totalHits !== results.length && (
                <> <em>of</em> <span className="font-bold text-black">{totalHits}</span></>
              )}
              <> <em>hits</em></>
            </span>
          </div>
          <ul className="results-list space-y-6">
            {results.map((result) => (
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
  );
} 