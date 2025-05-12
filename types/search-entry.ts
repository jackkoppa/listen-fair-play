/**
 * Output of processing SRT files
 * Used for FlexSearch index
 * Saved to S3
 * Each episode, when processed, results in an array of SearchEntry objects 
 * (each SearchEntry represents ~15-30 seconds of audio - see /processing/lamdas/convert-srt-files-into-search-entries.ts)
 */
export interface SearchEntry {
    id: string;
    episodeId: number;
    episodeTitle: string;
    startTimeMs: number;
    endTimeMs: number;
    text: string;
    [key: string]: string | number; // Add index signature for FlexSearch Document
  }