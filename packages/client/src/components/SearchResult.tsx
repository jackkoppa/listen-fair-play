import React from 'react';
import { ApiSearchResultHit, EpisodeInManifest } from '@listen-fair-play/types'; // Import the new type
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import EpisodeDetailsSheet from './EpisodeDetailsSheet';

import { formatDate } from '@/utils/date';
import { formatMillisecondsToMMSS } from '@/utils/time';




export interface SearchResultProps {
  result: ApiSearchResultHit;
  episodeData?: EpisodeInManifest;
}

const SearchResult: React.FC<SearchResultProps> = ({ result, episodeData }) => {
  const formattedStartTime = formatMillisecondsToMMSS(result.startTimeMs);
  const formattedEndTime = formatMillisecondsToMMSS(result.endTimeMs);
  const formattedDate = episodeData?.publishedAt ? formatDate(episodeData.publishedAt) : null;

  return (
    <Card className="result-item mb-4 border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{episodeData?.title || `Episode ${result.sequentialEpisodeIdAsString}`}</CardTitle>
        <CardDescription className="text-sm text-gray-600">
          {formattedDate && <Badge variant="destructive" className="mr-2">{formattedDate}</Badge>}
          <Badge variant="outline">{formattedStartTime} - {formattedEndTime}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="result-highlighted-text text-sm"
          dangerouslySetInnerHTML={{ __html: result.highlight || result.text }}
        />
      </CardContent>
      <CardFooter className="flex justify-end">
        {episodeData && <EpisodeDetailsSheet episodeData={episodeData} originalSearchResult={result} />}
      </CardFooter>
    </Card>
  );
};

export default SearchResult; 