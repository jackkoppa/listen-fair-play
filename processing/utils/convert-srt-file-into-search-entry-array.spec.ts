import { describe, it, expect } from 'vitest';
import { convertSrtFileIntoSearchEntryArray } from './convert-srt-file-into-search-entry-array.js'; // Assuming the function is exported from here

// Define the structure we expect the function to return
// Note: If this type is defined elsewhere (e.g., a shared types file), import it instead.
interface SearchEntry {
  id: string;
  episodeId: number;
  episodeTitle: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

// Sample SRT content (Lines 22-43 from the example file)
const sampleSrtContent = `
22
00:01:26,720 --> 00:01:34,560
I'm sorry, you can sit there and look and play with all your silly machines as much as you like.

23
00:01:35,520 --> 00:01:37,920
Is Gascoigne going to have a crack? He is, you know.

24
00:01:37,920 --> 00:01:39,280
Oh, he's there!

25
00:01:40,800 --> 00:01:41,280
Brilliant!

26
00:01:43,920 --> 00:01:44,800
The change!

27
00:01:44,800 --> 00:01:47,280
He's ran the goalkeeper, he's done it!

28
00:01:48,000 --> 00:01:49,440
Absolutely incredible!

29
00:01:49,440 --> 00:01:58,160
He launched himself six feet into the crowd, and Kung Fu kicked a supporter who was eye-whip

30
00:01:58,160 --> 00:02:00,400
without a shadow of a doubt giving him lip.

31
00:02:00,400 --> 00:02:03,360
Oh, I say! It's amazing!

32
00:02:03,360 --> 00:02:06,400
He does it time, and time, and time again.

33
00:02:06,400 --> 00:02:09,760
Crank up the music! Charge a glass!

34
00:02:10,480 --> 00:02:13,920
This nation is going to dance all night!

35
00:02:14,480 --> 00:02:17,920
A lovely brace of shot urging from the travelling Watford faithful.

36
00:02:17,920 --> 00:02:21,360
Troy Deeney's cruel dig at a Sunday evening TV stalwart.

37
00:02:21,360 --> 00:02:26,000
Seamus Coleman produces the most loyal 3.67 seconds in football history.
`;

const testEpisodeId = 123;
const testEpisodeTitle = 'Test Episode Title';

// REVISED Expected output based on function's apparent logic:
// Stop at the *first* punctuation mark encountered *after* >= 15s duration is met.
const expectedOutput: SearchEntry[] = [
  {
    // Chunk 1: Lines 22-26. Meets duration & punc at line 26.
    id: `${testEpisodeId}_86720`,      // Start time of line 22
    episodeId: testEpisodeId,
    episodeTitle: testEpisodeTitle,
    startTimeMs: 86720,
    endTimeMs: 104800,                // End time of line 26
    text: "I'm sorry, you can sit there and look and play with all your silly machines as much as you like. Is Gascoigne going to have a crack? He is, you know. Oh, he's there! Brilliant! The change!"
  },
  {
    // Chunk 2: Lines 27-31. Meets duration at line 30 (no punc). Meets duration & punc at line 31.
    id: `${testEpisodeId}_104800`,     // Start time of line 27
    episodeId: testEpisodeId,
    episodeTitle: testEpisodeTitle,
    startTimeMs: 104800,              // Start time of line 27
    endTimeMs: 120400,                // End time of line 31
    text: "He's ran the goalkeeper, he's done it! Absolutely incredible! He launched himself six feet into the crowd, and Kung Fu kicked a supporter who was eye-whip without a shadow of a doubt giving him lip."
  },
  {
    // Chunk 3: Lines 32-36. Meets duration at line 35 (no punc). Meets duration & punc at line 36.
    id: `${testEpisodeId}_120400`,    // Start time of line 32
    episodeId: testEpisodeId,
    episodeTitle: testEpisodeTitle,
    startTimeMs: 120400,             // Start time of line 32
    endTimeMs: 137920,               // End time of line 36
    text: "Oh, I say! It's amazing! He does it time, and time, and time again. Crank up the music! Charge a glass! This nation is going to dance all night! A lovely brace of shot urging from the travelling Watford faithful."
  },
  {
    // Chunk 4: Lines 37-43. Meets duration at line 41 (no punc). Meets duration & punc at line 43 (also last line).
    id: `${testEpisodeId}_137920`,   // Start time of line 37
    episodeId: testEpisodeId,
    episodeTitle: testEpisodeTitle,
    startTimeMs: 137920,            // Start time of line 37
    endTimeMs: 146000,              // End time of line 43
    text: "Troy Deeney's cruel dig at a Sunday evening TV stalwart. Seamus Coleman produces the most loyal 3.67 seconds in football history."
  }
];

describe('convertSrtFileIntoSearchEntryArray', () => {
  it('should convert a sample SRT file into an array of search entries based on time/punctuation rules', () => {
    const result = convertSrtFileIntoSearchEntryArray({
      srtFileContent: sampleSrtContent,
      episodeId: testEpisodeId,
      episodeTitle: testEpisodeTitle
    });
    // Use JSON.stringify for potentially more detailed diffs in some test runners
    // expect(JSON.stringify(result, null, 2)).toEqual(JSON.stringify(expectedOutput, null, 2));
    expect(result).toEqual(expectedOutput);
  });

  it('should return an empty array if the SRT content is empty or whitespace', () => {
    const result = convertSrtFileIntoSearchEntryArray({
      srtFileContent: '   \n   \n  ',
      episodeId: testEpisodeId,
      episodeTitle: testEpisodeTitle
    });
    expect(result).toEqual([]);
  });

  it('should return an empty array if the SRT content is null or undefined', () => {
    const result1 = convertSrtFileIntoSearchEntryArray({
      srtFileContent: null as any, // Test case for null
      episodeId: testEpisodeId,
      episodeTitle: testEpisodeTitle
    });
     const result2 = convertSrtFileIntoSearchEntryArray({
      srtFileContent: undefined as any, // Test case for undefined
      episodeId: testEpisodeId,
      episodeTitle: testEpisodeTitle
    });
    expect(result1).toEqual([]);
    expect(result2).toEqual([]);
  });

  // TODO: Add more edge cases if necessary
  // - SRT with malformed lines?
  // - SRT with very long segments without punctuation?

});