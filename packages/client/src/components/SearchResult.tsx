import React from 'react';
import { ApiSearchResultHit } from '@listen-fair-play/types'; // Import the new type

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
    <li className="result-item">
      <div className="result-header">
        <span className="result-episode-title">{result.episodeTitle}</span>
        <span className="result-timestamp-condensed">{formattedStartTime} - {formattedEndTime}</span>
      </div>
      <div 
        className="result-highlighted-text"
        dangerouslySetInnerHTML={{ __html: result.highlight }}
      />
      {/* <div className="result-full-text">{result.text}</div> */}
      {/* Display full text if needed, or remove */}
    </li>
  );
};

export default SearchResult; 