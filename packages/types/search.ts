/**
 * Output of processing SRT files
 * Used for FlexSearch index
 * Saved to S3
 */
export interface SearchEntry {
  id: string;
  sequentialEpisodeId: number;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  [key: string]: string | number; // Add index signature for FlexSearch Document
}

export interface ApiSearchResultHit extends SearchEntry {
  highlight: string;
}