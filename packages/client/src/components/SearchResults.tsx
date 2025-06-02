import { ApiSearchResultHit, EpisodeManifest } from '@listen-fair-play/types'
import SearchResult from './SearchResult'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { SortOption } from '../types/search'

interface SearchResultsProps {
  results: ApiSearchResultHit[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  mostRecentSuccessfulSearchQuery: string | null;
  totalHits: number;
  processingTimeMs: number;
  episodeManifest: EpisodeManifest | null;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  // Pagination props
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
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
      <span className="text-muted-foreground">
        {isLoading ? (
          <em>Search time: <div className="h-3 w-12 bg-gray-200 animate-pulse rounded inline-block align-middle"></div></em>
        ) : (
          processingTimeSeconds > 0 && <em>Search time: {processingTimeSeconds}s</em>
        )}
      </span>
      <span className="text-foreground">
        <em>Showing:</em> <span className="font-bold">
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
  mostRecentSuccessfulSearchQuery,
  totalHits,
  processingTimeMs,
  episodeManifest,
  sortOption,
  onSortChange,
  currentPage,
  itemsPerPage,
  onPageChange,
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

  // Only show this banner area once we've had a successful search
  const showResultsInfo = Boolean(mostRecentSuccessfulSearchQuery);

  // Calculate pagination
  const totalPages = Math.ceil(totalHits / itemsPerPage);
  const hasMultiplePages = totalPages > 1;

  const renderPagination = () => {
    if (!hasMultiplePages || isLoading) return null;

    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    const adjustedStartPage = Math.max(1, endPage - maxVisiblePages + 1);

    const pages = [];
    for (let i = adjustedStartPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="mt-8 flex justify-center">
        <Pagination>
          <PaginationContent>
            {currentPage > 1 && (
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => onPageChange(currentPage - 1)}
                  className="cursor-pointer"
                />
              </PaginationItem>
            )}
            
            {adjustedStartPage > 1 && (
              <>
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => onPageChange(1)}
                    className="cursor-pointer"
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
                {adjustedStartPage > 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
              </>
            )}
            
            {pages.map((page) => (
              <PaginationItem key={page}>
                <PaginationLink 
                  onClick={() => onPageChange(page)}
                  isActive={page === currentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            
            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => onPageChange(totalPages)}
                    className="cursor-pointer"
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              </>
            )}
            
            {currentPage < totalPages && (
              <PaginationItem>
                <PaginationNext 
                  onClick={() => onPageChange(currentPage + 1)}
                  className="cursor-pointer"
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <div className="results-container">
      {showResultsInfo && (
        <div className="results-info-and-controls flex justify-between items-start mb-4 text-xs sm:text-[12px]">
        {/* Left side: Search time and hits info */}
        <SearchTimeAndResultCount
          isLoading={isLoading}
          processingTimeSeconds={processingTimeSeconds}
          totalHits={totalHits}
          results={results}
        />

        {/* Right side: Sort dropdown */}
        <div className="flex items-start gap-2 text-foreground">
          <label className="font-bold text-right">Sort<br/>by</label>
          <Select value={sortOption} onValueChange={(value: SortOption) => onSortChange(value)}>
            <SelectTrigger className="w-32 border-foreground border-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-foreground border-2 shadow-sm rounded-none">
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>
      )}

      {isLoading && !error ? (
        <div className="loading-skeleton space-y-6">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="border-foreground border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none p-4">
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
        <>
          <ul className="results-list space-y-6">
            {results.map((result) => (
              <SearchResult
                key={result.id}
                result={result}
                episodeData={episodeManifest?.episodes.find(ep => ep.sequentialId === parseInt(result.sequentialEpisodeIdAsString))}
              />
            ))}
          </ul>
          {renderPagination()}
        </>
      ) : searchQuery.trim().length >= 2 && !error ? (
        <p className="no-results text-lg text-gray-600 text-center bg-gray-100 p-6 border-foreground border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none">
          No results found for "{searchQuery}". Try a different term, perhaps something more pedantic?
        </p>
      ) : null}
    </div>
  );
} 