import { describe, it, expect } from 'vitest';
import { parseTranscriptContent } from './parseTranscriptContent';

describe('parseTranscriptContent', () => {
  it('should parse a simple SRT file properly', () => {
    const simpleSrt = `1
00:00:00,000 --> 00:00:06,080
Hello everyone, welcome to the podcast.

2
00:00:06,080 --> 00:00:10,000
Today we're discussing football.`;

    const result = parseTranscriptContent(simpleSrt, 'test.srt');
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 1,
      startTime: '00:00:00,000',
      endTime: '00:00:06,080',
      speaker: '',
      text: 'Hello everyone, welcome to the podcast.',
      fullText: 'Hello everyone, welcome to the podcast.',
      fileName: 'test.srt'
    });
    
    expect(result[1]).toEqual({
      id: 2,
      startTime: '00:00:06,080',
      endTime: '00:00:10,000',
      speaker: '',
      text: 'Today we\'re discussing football.',
      fullText: 'Today we\'re discussing football.',
      fileName: 'test.srt'
    });
  });

  it('should parse a SRT file with speaker tags correctly', () => {
    const srtWithSpeakers = `1
00:00:00,000 --> 00:00:06,080
[SPEAKER_1]: Hello everyone, welcome to the podcast.

2
00:00:06,080 --> 00:00:10,000
[SPEAKER_2]: Today we're discussing football.`;

    const result = parseTranscriptContent(srtWithSpeakers, 'with-speakers.srt');
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 1,
      startTime: '00:00:00,000',
      endTime: '00:00:06,080',
      speaker: '[SPEAKER_1]:',
      text: 'Hello everyone, welcome to the podcast.',
      fullText: '[SPEAKER_1]: Hello everyone, welcome to the podcast.',
      fileName: 'with-speakers.srt'
    });
    
    expect(result[1]).toEqual({
      id: 2,
      startTime: '00:00:06,080',
      endTime: '00:00:10,000',
      speaker: '[SPEAKER_2]:',
      text: 'Today we\'re discussing football.',
      fullText: '[SPEAKER_2]: Today we\'re discussing football.',
      fileName: 'with-speakers.srt'
    });
  });

  it('should handle multi-line text entries correctly', () => {
    const multiLineSrt = `1
00:00:00,000 --> 00:00:06,080
[SPEAKER_1]: Hello everyone, sorry to keep you all waiting, 
and welcome to a very important announcement.`;

    const result = parseTranscriptContent(multiLineSrt, 'multi-line.srt');
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      startTime: '00:00:00,000',
      endTime: '00:00:06,080',
      speaker: '[SPEAKER_1]:',
      text: 'Hello everyone, sorry to keep you all waiting, and welcome to a very important announcement.',
      fullText: '[SPEAKER_1]: Hello everyone, sorry to keep you all waiting, and welcome to a very important announcement.',
      fileName: 'multi-line.srt'
    });
  });

  it('should handle real SRT excerpt from a football podcast', () => {
    const realSrtExcerpt = `1
00:00:00,000 --> 00:00:06,080
Hello everyone, sorry to keep you all waiting, and welcome to a very important Football Clichés

2
00:00:06,080 --> 00:00:07,080
announcement.

3
00:00:07,080 --> 00:00:11,480
After three years and 262 glorious episodes for The Athletic, in which we brought a handful`;

    const result = parseTranscriptContent(realSrtExcerpt, 'football-cliches.srt');
    
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(1);
    expect(result[0].text).toBe('Hello everyone, sorry to keep you all waiting, and welcome to a very important Football Clichés');
    expect(result[1].id).toBe(2);
    expect(result[1].text).toBe('announcement.');
    expect(result[2].id).toBe(3);
    expect(result[2].text).toBe('After three years and 262 glorious episodes for The Athletic, in which we brought a handful');
  });

  it('should parse the actual Football Clichés SRT file correctly', () => {
    const footballClichesSrt = `1
00:00:00,000 --> 00:00:06,080
Hello everyone, sorry to keep you all waiting, and welcome to a very important Football Clichés

2
00:00:06,080 --> 00:00:07,080
announcement.

3
00:00:07,080 --> 00:00:11,480
After three years and 262 glorious episodes for The Athletic, in which we brought a handful

4
00:00:11,480 --> 00:00:15,800
of previously mundane phrases to unnecessarily mainstream attention, and learned the footballing

5
00:00:15,800 --> 00:00:20,760
loves and hates of politicians, footballers, TV presenters, stand-up comedians, and cult

6
00:00:20,760 --> 00:00:24,959
deputy chief medical officers, the Football Clichés podcast is moving to a new home.

7
00:00:24,959 --> 00:00:29,240
Those 262 episodes will stay right here in the back catalogue, but we'll be relaunching

8
00:00:29,240 --> 00:00:30,799
the pod on a brand new feed.`;

    const result = parseTranscriptContent(footballClichesSrt, "2023-10-12_Football-Cliches-has-moved-Heres-where-to-find-u.srt");
    
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({
      id: 1,
      startTime: '00:00:00,000',
      endTime: '00:00:06,080',
      speaker: '',
      text: 'Hello everyone, sorry to keep you all waiting, and welcome to a very important Football Clichés',
      fullText: 'Hello everyone, sorry to keep you all waiting, and welcome to a very important Football Clichés',
      fileName: "2023-10-12_Football-Cliches-has-moved-Heres-where-to-find-u.srt"
    });
    
    expect(result[5]).toEqual({
      id: 6,
      startTime: '00:00:20,760',
      endTime: '00:00:24,959',
      speaker: '',
      text: 'deputy chief medical officers, the Football Clichés podcast is moving to a new home.',
      fullText: 'deputy chief medical officers, the Football Clichés podcast is moving to a new home.',
      fileName: "2023-10-12_Football-Cliches-has-moved-Heres-where-to-find-u.srt"
    });
  });
}); 