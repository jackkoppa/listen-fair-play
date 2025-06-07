import { describe, it, expect } from 'vitest';
import { getEpisodeFileKey } from './get-episode-file-key.js';

describe('getEpisodeFileKey', () => {
    const samplePubDate = 'Thu, 25 Jul 2024 14:54:00 -0000';
    
    it('should generate a basic file key with date and sanitized title', () => {
        const title = 'Simple Episode Title';
        const result = getEpisodeFileKey(title, samplePubDate);
        
        expect(result).toBe('2024-07-25_Simple-Episode-Title');
    });
    
    it('should replace invalid filename characters with hyphens', () => {
        const title = 'Episode/With\\Invalid?Characters*:|"<>.';
        const result = getEpisodeFileKey(title, samplePubDate);
        
        expect(result).toBe('2024-07-25_Episode-With-Invalid-Characters-------');
    });
    
    it('should replace multiple spaces with single hyphens', () => {
        const title = 'Episode   With     Multiple    Spaces';
        const result = getEpisodeFileKey(title, samplePubDate);
        
        expect(result).toBe('2024-07-25_Episode-With-Multiple-Spaces');
    });
    
    it('should limit title length to 50 characters', () => {
        const title = 'This Is A Very Long Episode Title That Should Be Truncated To Fifty Characters';
        const result = getEpisodeFileKey(title, samplePubDate);
        
        expect(result).toBe('2024-07-25_This-Is-A-Very-Long-Episode-Title-That-Should-Be-T');
        expect(result.length).toBe(61); // 10 (date) + 1 (underscore) + 50 (truncated title length)
    });
    
    it('should handle different date formats correctly', () => {
        const title = 'Test Episode';
        const isoDate = '2023-12-25T10:30:00Z';
        const result = getEpisodeFileKey(title, isoDate);
        
        expect(result).toBe('2023-12-25_Test-Episode');
    });
    
    it('should handle the Football Clichés episode with accented characters consistently', () => {
        // This test demonstrates the normalization issue
        // The title contains "Clichés" with an accented é character
        const title = 'The Football Clichés Quiz XIV: Cliches vs The Sweeper';
        const pubDate = 'Thu, 25 Jul 2024 14:54:00 -0000';
        
        const result = getEpisodeFileKey(title, pubDate);
        
        // Additional test: ensure the result is consistently the same
        // even if the input has differently composed Unicode characters
        const titleWithDecomposedE = 'The Football Cliche\u0301s Quiz XIV: Cliches vs The Sweeper'; // é as e + combining acute accent
        const resultDecomposed = getEpisodeFileKey(titleWithDecomposedE, pubDate);
        
        // This test verifies that Unicode normalization works correctly
        // Unicode characters can be encoded in different ways, but after normalization
        // these should be identical
        expect(result).toBe(resultDecomposed);
    });
    
    it('should handle empty title gracefully', () => {
        const title = '';
        const result = getEpisodeFileKey(title, samplePubDate);
        
        expect(result).toBe('2024-07-25_');
    });
    
    it('should handle title with only invalid characters', () => {
        const title = '/\\?%*:|"<>.';
        const result = getEpisodeFileKey(title, samplePubDate);
        
        expect(result).toBe('2024-07-25_-----------');
    });
    
    it('should handle Unicode characters beyond ASCII', () => {
        const title = 'Podcast über Fußball with émojis 🏈⚽';
        const result = getEpisodeFileKey(title, samplePubDate);
        
        // After normalization, Unicode characters should be preserved
        // but the emoji might be handled differently by the sanitization
        expect(result).toContain('2024-07-25_Podcast-über-Fußball-with-émojis');
    });
});