import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiSearchResultHit, EpisodeInManifest } from '@listen-fair-play/types'; // Import the new type
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "@radix-ui/react-icons";

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
    <Card className="result-item mb-4 border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none gap-2">
      <CardContent>
        <HighlightedText text={result.text} searchStringToHighlight={searchParams.get('q') || ''} />
      </CardContent>
      <CardFooter className="block">
        {episodeData && (
          <>
            <div className="flex justify-between">
              <div className="flex items-center flex-wrap gap-2">
                {formattedDate && <Badge variant="destructive" className="mr-2">{formattedDate}</Badge>}
                <Badge variant="outline">{formattedStartTime} - {formattedEndTime}</Badge>
              </div>
              <Button onClick={handleLoadHere}>
                <PlayIcon />
                Load Here
              </Button>
            </div>
            <div className="text-xs text-gray-600 w-full block mt-4 italic">{episodeData?.title || `Episode ${result.sequentialEpisodeIdAsString}`}</div>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default SearchResult; 