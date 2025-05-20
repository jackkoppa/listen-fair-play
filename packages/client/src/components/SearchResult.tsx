import React from 'react';
import { ApiSearchResultHit } from '@listen-fair-play/types'; // Import the new type
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Utility function to format milliseconds to MM:SS
const formatMillisecondsToMMSS = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export interface SearchResultProps {
  result: ApiSearchResultHit;
}

const SearchResult: React.FC<SearchResultProps> = ({ result }) => {
  const formattedStartTime = formatMillisecondsToMMSS(result.startTimeMs);
  const formattedEndTime = formatMillisecondsToMMSS(result.endTimeMs);

  return (
    <Card className="result-item mb-4 border-black border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{result.episodeTitle}</CardTitle>
        <CardDescription className="text-sm text-gray-600">
          {formattedStartTime} - {formattedEndTime}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="result-highlighted-text text-sm"
          dangerouslySetInnerHTML={{ __html: result.highlight }}
        />
      </CardContent>
    </Card>
  );
};

export default SearchResult; 