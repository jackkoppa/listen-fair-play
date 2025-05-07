import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
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
const expectedOutput: SearchEntry[] = require('./__fixtures__/expected-search-entry-1.json');

describe('convertSrtFileIntoSearchEntryArray', () => {
  it('should convert a sample SRT file into an array of search entries based on time/punctuation rules', () => {
    const sampleSrtContent = fs.readFileSync(
      path.join(__dirname, '__fixtures__/example-transcription-1.srt'),
      'utf-8'
    );
    const expectedOutput = require('./__fixtures__/expected-search-entry-1.json');
    const episodeDetails = require('./__fixtures__/example-episode-details-1.json');

    const result = convertSrtFileIntoSearchEntryArray({
      srtFileContent: sampleSrtContent,
      episodeId: episodeDetails.id,
      episodeTitle: episodeDetails.title
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