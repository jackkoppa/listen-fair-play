import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SortOption = 'relevance' | 'newest' | 'oldest';

interface Episode {
  sequentialId: number;
  title: string;
  publishedAt: string;
}

interface SearchControlsProps {
  searchQuery: string;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  selectedEpisodeIds: number[];
  onEpisodeSelection: (episodeId: number, isSelected: boolean) => void;
  onClearEpisodeFilters: () => void;
  availableEpisodes: Episode[];
  showEpisodeFilter: boolean;
  onToggleEpisodeFilter: () => void;
}

export default function SearchControls({
  searchQuery,
  sortOption,
  onSortChange,
  selectedEpisodeIds,
  onEpisodeSelection,
  onClearEpisodeFilters,
  availableEpisodes,
  showEpisodeFilter,
  onToggleEpisodeFilter,
}: SearchControlsProps) {
  // Only show search controls when there's a search query
  if (searchQuery.trim().length < 2) {
    return null;
  }

  return (
    <div className="search-controls">
      <div className="flex flex-wrap justify-end gap-4 mb-4">
        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold">Sort by:</label>
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

        {/* Episode Filter Controls */}
        {/* TODO: Re-enable if & when we want this in place */}
        <div className="flex items-center gap-2 hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleEpisodeFilter}
            className="border-black border-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] rounded-none"
          >
            Filter Episodes ({selectedEpisodeIds.length})
          </Button>
          {selectedEpisodeIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearEpisodeFilters}
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
                  onChange={(e) => onEpisodeSelection(episode.sequentialId, e.target.checked)}
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
  );
}

export type { SortOption }; 