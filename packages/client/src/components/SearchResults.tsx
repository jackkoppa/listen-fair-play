import { ApiSearchResultHit, EpisodeManifest } from '@listen-fair-play/types'
import SearchResult from './SearchResult'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SortOption } from '../types/search'

interface SearchResultsProps {
  results: ApiSearchResultHit[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  totalHits: number;
  processingTimeMs: number;
  episodeManifest: EpisodeManifest | null;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
}

interface SearchTimeAndResultCountProps {
  isLoading: boolean;
  processingTimeSeconds: number;
  totalHits: number;
  results: ApiSearchResultHit[];
}


const SearchTimeAndResultCount = ({
  isLoading,
  processingTimeSeconds,
  totalHits,
  results,
}: SearchTimeAndResultCountProps) => {
  return (
    <div className="flex flex-col gap-2 self-end">
      <span className="text-gray-600">
        {isLoading ? (
          <em>Search time: <div className="h-3 w-12 bg-gray-200 animate-pulse rounded inline-block align-middle"></div></em>
        ) : (
          processingTimeSeconds > 0 && <em>Search time: {processingTimeSeconds}s</em>
        )}
      </span>
      <span>
        <em>Showing:</em> <span className="font-bold text-black">
          {isLoading ? (
            <div className="h-3 w-10 bg-gray-200 animate-pulse rounded inline-block align-middle"></div>
          ) : (
            <>
              {results.length}
              {totalHits !== results.length && (
                <> <em>of</em> {totalHits}</>
              )}
            </>
          )}
        </span>
        <> <em>hits</em></>
      </span>
    </div>
  )
}

export default function SearchResults({
  results,
  isLoading,
  error,
  searchQuery,
  totalHits,
  processingTimeMs,
  episodeManifest,
  sortOption,
  onSortChange,
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

  // round to nearest 0.001 seconds
  const processingTimeSeconds = Number((processingTimeMs / 1000).toFixed(3));

  return (
    <div className="results-container">
      <div className="results-info-and-controls flex justify-between items-start mb-4 text-xs sm:text-[12px]">
        {/* Left side: Search time and hits info */}
        <SearchTimeAndResultCount
          isLoading={isLoading}
          processingTimeSeconds={processingTimeSeconds}
          totalHits={totalHits}
          results={results}
        />

        {/* Right side: Sort dropdown */}
        <div className="flex items-start gap-1 sm:gap-2">
          <label className="font-semibold text-right">Sort<br/>by</label>
          <Select value={sortOption} onValueChange={(value: SortOption) => onSortChange(value)}>
            <SelectTrigger className="w-32 border-black border-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none">
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && !error ? (
        <div className="loading-skeleton space-y-6">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="h-4 w-16 bg-gray-200 animate-pulse rounded"></div>
                <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"></div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                <div className="h-4 w-3/4 bg-gray-200 animate-pulse rounded"></div>
              </div>
              <div className="h-4 w-32 bg-gray-200 animate-pulse rounded"></div>
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <ul className="results-list space-y-6">
          {results.map((result) => (
            <SearchResult
              key={result.id}
              result={result}
              episodeData={episodeManifest?.episodes.find(ep => ep.sequentialId === parseInt(result.sequentialEpisodeIdAsString))}
            />
          ))}
        </ul>
      ) : searchQuery.trim().length >= 2 && !error ? (
        <p className="no-results text-lg text-gray-600 text-center bg-gray-100 p-6 border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none">
          No results found for "{searchQuery}". Try a different term, perhaps something more pedantic?
        </p>
      ) : null}
    </div>
  );
} 