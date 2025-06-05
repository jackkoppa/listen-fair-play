import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applySpellingCorrections, applyCorrectionToFile } from './apply-spelling-corrections.js';
import fs from 'fs-extra';

// Mock fs-extra
vi.mock('fs-extra');

// Mock the config file reading
const mockConfig = {
  correctionsToApply: [
    {
      misspellings: ["Charlie Eccleshead", "charlie eccleshead", "Charlie Eccleshire"],
      correctedSpelling: "Charlie Eccleshare"
    },
    {
      misspellings: ["Adam Hurry"],
      correctedSpelling: "Adam Hurrey"
    },
    {
      misspellings: ["keys and gray", "keys and grey"],
      correctedSpelling: "Keys and Gray"
    }
  ]
};

describe('applySpellingCorrections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fs operations
    (fs.pathExists as any).mockResolvedValue(true);
    (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
  });

  it('should apply spelling corrections to SRT content', async () => {
    const srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello, I'm Charlie Eccleshead and this is the podcast.

2
00:00:05,000 --> 00:00:10,000
Today we have Adam Hurry joining us to discuss keys and gray.

3
00:00:10,000 --> 00:00:15,000
Welcome to the show Charlie Eccleshead!`;

    const result = await applySpellingCorrections(srtContent);

    expect(result.totalCorrections).toBe(4);
    expect(result.correctionResults).toHaveLength(3);
    
    // Check that corrections were applied
    expect(result.correctedContent).toContain('Charlie Eccleshare');
    expect(result.correctedContent).toContain('Adam Hurrey');
    expect(result.correctedContent).toContain('Keys and Gray');
    expect(result.correctedContent).not.toContain('Charlie Eccleshead');
    expect(result.correctedContent).not.toContain('Adam Hurry');
    expect(result.correctedContent).not.toContain('keys and gray');

    // Check correction results
    const charlieCorrection = result.correctionResults.find(r => r.correctedSpelling === 'Charlie Eccleshare');
    expect(charlieCorrection?.correctionsApplied).toBe(2);

    const adamCorrection = result.correctionResults.find(r => r.correctedSpelling === 'Adam Hurrey');
    expect(adamCorrection?.correctionsApplied).toBe(1);

    const keysCorrection = result.correctionResults.find(r => r.correctedSpelling === 'Keys and Gray');
    expect(keysCorrection?.correctionsApplied).toBe(1);
  });

  it('should handle case-insensitive matching', async () => {
    const srtContent = `1
00:00:00,000 --> 00:00:05,000
This is charlie eccleshead speaking.`;

    const result = await applySpellingCorrections(srtContent);

    expect(result.totalCorrections).toBe(1);
    expect(result.correctedContent).toContain('Charlie Eccleshare');
    expect(result.correctedContent).not.toContain('charlie eccleshead');
  });

  it('should only match whole words', async () => {
    const srtContent = `1
00:00:00,000 --> 00:00:05,000
This is not Charlie Ecclesheading but Charlie Eccleshead is here.`;

    const result = await applySpellingCorrections(srtContent);

    // Should only correct the whole word, not the partial match
    expect(result.totalCorrections).toBe(1);
    expect(result.correctedContent).toContain('Charlie Ecclesheading'); // Unchanged
    expect(result.correctedContent).toContain('Charlie Eccleshare is here');
  });

  it('should return unchanged content when no corrections are needed', async () => {
    const srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello, this is Charlie Eccleshare speaking.`;

    const result = await applySpellingCorrections(srtContent);

    expect(result.totalCorrections).toBe(0);
    expect(result.correctionResults).toHaveLength(0);
    expect(result.correctedContent).toBe(srtContent);
  });

  it('should handle empty or whitespace content', async () => {
    const result1 = await applySpellingCorrections('');
    const result2 = await applySpellingCorrections('   \n   ');

    expect(result1.totalCorrections).toBe(0);
    expect(result1.correctedContent).toBe('');

    expect(result2.totalCorrections).toBe(0);
    expect(result2.correctedContent).toBe('   \n   ');
  });
});

describe('applyCorrectionToFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.pathExists as any).mockResolvedValue(true);
    (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
  });

  it('should apply corrections to a file and save when corrections are made', async () => {
    const mockContent = `1
00:00:00,000 --> 00:00:05,000
Hello Charlie Eccleshead!`;

    const mockGetFileContent = vi.fn().mockResolvedValue(mockContent);
    const mockSaveFileContent = vi.fn().mockResolvedValue(undefined);

    const result = await applyCorrectionToFile(
      'test.srt',
      mockGetFileContent,
      mockSaveFileContent
    );

    expect(result.totalCorrections).toBe(1);
    expect(mockGetFileContent).toHaveBeenCalledWith('test.srt');
    expect(mockSaveFileContent).toHaveBeenCalledWith(
      'test.srt',
      expect.stringContaining('Charlie Eccleshare')
    );
  });

  it('should not save file when no corrections are needed', async () => {
    const mockContent = `1
00:00:00,000 --> 00:00:05,000
Hello Charlie Eccleshare!`;

    const mockGetFileContent = vi.fn().mockResolvedValue(mockContent);
    const mockSaveFileContent = vi.fn().mockResolvedValue(undefined);

    const result = await applyCorrectionToFile(
      'test.srt',
      mockGetFileContent,
      mockSaveFileContent
    );

    expect(result.totalCorrections).toBe(0);
    expect(mockGetFileContent).toHaveBeenCalledWith('test.srt');
    expect(mockSaveFileContent).not.toHaveBeenCalled();
  });
}); 