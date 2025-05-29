import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiSearchResultHit, EpisodeInManifest } from '@listen-fair-play/types'; // Import the new type
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { formatDate } from '@/utils/date';
import { formatMillisecondsToMMSS } from '@/utils/time';
import HighlightedText from './HighlightedText';

export interface SearchResultProps {
  result: ApiSearchResultHit;
  episodeData?: EpisodeInManifest;
}

const SearchResult: React.FC<SearchResultProps> = ({ result, episodeData }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const formattedStartTime = formatMillisecondsToMMSS(result.startTimeMs);
  const formattedEndTime = formatMillisecondsToMMSS(result.endTimeMs);
  const formattedDate = episodeData?.publishedAt ? formatDate(episodeData.publishedAt) : null;

  const handleLoadHere = () => {
    if (!episodeData) return;

    // Preserve all current search query parameters
    const currentParams = new URLSearchParams(searchParams);

    // Add episode-specific parameters
    currentParams.set('start', result.startTimeMs.toString());

    // Navigate to episode route with all parameters
    const queryString = currentParams.toString();
    navigate(`/episode/${episodeData.sequentialId}${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <Card 
      className="mb-4 border-foreground border-2 gap-2 cursor-pointer hover:bg-muted dark:hover:bg-dark-mode-muted-highlight" 
      onClick={handleLoadHere}
    >
      <CardContent>
        <HighlightedText className="text-sm" text={result.text} searchStringToHighlight={searchParams.get('q') || ''} />
      </CardContent>
      <CardFooter className="block">
        {episodeData && (
          <>
            <div className="flex flex-col mt-2">
              <div className="flex items-center gap-2">
                {formattedDate && <Badge variant="destructive" className="mr-2">{formattedDate}</Badge>}
                <Badge variant="outline">{formattedStartTime} - {formattedEndTime}</Badge>
              </div>
              <div className="text-xs text-muted-foreground w-full block mt-2 italic">{episodeData?.title || `Episode ${result.sequentialEpisodeIdAsString}`}</div>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default SearchResult; 