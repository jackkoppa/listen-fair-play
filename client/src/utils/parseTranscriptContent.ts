import { TranscriptEntry } from '../components/SearchResult';

/**
 * Parses SRT transcript file content into structured transcript entries
 * @param content - The raw SRT file content as string
 * @param fileName - The name of the file being parsed
 * @returns An array of parsed TranscriptEntry objects
 */
export function parseTranscriptContent(content: string, fileName: string): TranscriptEntry[] {
  const parsedEntries: TranscriptEntry[] = [];
  const lines = content.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    // Skip empty lines
    if (lines[i].trim() === '') {
      i++;
      continue;
    }
    
    // Parse entry ID
    const idLine = lines[i].trim();
    if (isNaN(Number(idLine))) {
      i++;
      continue;
    }
    
    const id = Number(idLine);
    i++;
    
    // Parse timestamp line
    if (i >= lines.length) break;
    const timestampLine = lines[i].trim();
    if (!timestampLine.includes('-->')) {
      i++;
      continue;
    }
    
    const [startTime, endTime] = timestampLine.split('-->').map(t => t.trim());
    i++;
    
    // Parse and collect text lines until we reach an empty line or end of file
    let textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i].trim());
      i++;
    }
    
    if (textLines.length > 0) {
      // For speakers and text, we need to check the first text line
      // Some SRT files have speaker tags like [SPEAKER_1]: at the beginning
      const fullText = textLines.join(' ');
      let speaker = '';
      let text = fullText;
      
      const speakerMatch = fullText.match(/^\[SPEAKER_\d+\]:/);
      if (speakerMatch) {
        speaker = speakerMatch[0];
        text = fullText.substring(speaker.length).trim();
      }
      
      parsedEntries.push({
        id,
        startTime,
        endTime,
        speaker,
        text,
        fullText,
        fileName
      });
    }
  }
  
  return parsedEntries;
}

export default parseTranscriptContent; 