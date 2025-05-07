// Define the structure for a search index entry
interface SearchEntry {
    id: string;
    episodeId: number;
    episodeTitle: string;
    startTimeMs: number;
    endTimeMs: number;
    text: string;
}

interface ConvertSrtFileIntoSearchEntryArrayProps {
    srtFileContent: string | null | undefined; // Allow null/undefined
    episodeId: number;
    episodeTitle: string;
}

// Helper function to convert SRT time string (HH:MM:SS,ms) to milliseconds
const srtTimeToMilliseconds = (time: string): number => {
    const parts = time.split(/[:,]/);
    if (parts.length !== 4) {
        // Handle potential malformed time strings gracefully
        console.warn(`Malformed SRT time string encountered: ${time}`);
        return 0; 
    }
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    const milliseconds = parseInt(parts[3], 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;
};

// Structure for parsed SRT line
interface ParsedSrtLine {
    index: number;
    startTimeMs: number;
    endTimeMs: number;
    text: string;
}

// Regex to parse SRT blocks
// Group 1: Index
// Group 2: Start time
// Group 3: End time
// Group 4: Text content (can span multiple lines)
const srtBlockRegex = /(\d+)\s*\n(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\n([\s\S]*?)(?=\n\n|\n*$)/g;

// Regex to check for sentence ending punctuation
const sentenceEndRegex = /[.!?]$/;

// Minimum chunk duration in milliseconds
const MIN_CHUNK_DURATION_MS = 15000;

export const convertSrtFileIntoSearchEntryArray = ({
    srtFileContent,
    episodeId,
    episodeTitle
}: ConvertSrtFileIntoSearchEntryArrayProps): SearchEntry[] => {

    if (!srtFileContent || typeof srtFileContent !== 'string') {
        return [];
    }

    const trimmedContent = srtFileContent.trim();
    if (trimmedContent === '') {
        return [];
    }

    const parsedLines: ParsedSrtLine[] = [];
    let match;

    // Reset regex lastIndex before starting
    srtBlockRegex.lastIndex = 0;

    while ((match = srtBlockRegex.exec(trimmedContent)) !== null) {
        // Clean up the text: remove leading/trailing whitespace and replace newlines within the text block with spaces
        const cleanedText = match[4].replace(/\r?\n/g, ' ').trim();
        if (cleanedText) { // Only add lines with actual text content
            parsedLines.push({
                index: parseInt(match[1], 10),
                startTimeMs: srtTimeToMilliseconds(match[2]),
                endTimeMs: srtTimeToMilliseconds(match[3]),
                text: cleanedText
            });
        }
    }

    if (parsedLines.length === 0) {
        return []; // No valid SRT blocks found
    }

    console.log(`--- Starting Chunking for Episode ${episodeId} ---`); // LOG: Start
    console.log(`Total parsed lines: ${parsedLines.length}`);

    const searchEntries: SearchEntry[] = [];
    let currentChunkLines: ParsedSrtLine[] = [];
    let chunkStartTimeMs = 0;
    let chunkEndTimeMs = 0;
    let chunkCombinedText = '';

    for (let i = 0; i < parsedLines.length; i++) {
        const line = parsedLines[i];
        const isLastLineOverall = i === parsedLines.length - 1;

        console.log(`\n[Loop Iteration i=${i}, Line Index=${line.index}]`); // LOG: Loop start

        if (currentChunkLines.length === 0) {
            chunkStartTimeMs = line.startTimeMs;
            console.log(`  New Chunk Start: startTimeMs=${chunkStartTimeMs}`); // LOG: New chunk
        }

        currentChunkLines.push(line);
        chunkEndTimeMs = line.endTimeMs; // Update chunk end time
        chunkCombinedText = (chunkCombinedText ? chunkCombinedText + ' ' : '') + line.text; // Append text

        const actualChunkStartTimeForDuration = currentChunkLines.length > 0 ? currentChunkLines[0].startTimeMs : line.startTimeMs; // Fallback to current line if it's the first
        const currentDuration = chunkEndTimeMs - actualChunkStartTimeForDuration;
        console.log(`  Added Line ${line.index}: text="${line.text}"`); // LOG: Line added
        console.log(`  Current Chunk End Time: ${chunkEndTimeMs}`);
        console.log(`  Current Chunk Duration: ${currentDuration}ms (Start: ${actualChunkStartTimeForDuration}, End: ${chunkEndTimeMs})`); // LOG: Duration

        let finalizeChunk = false;
        const durationMet = currentDuration >= MIN_CHUNK_DURATION_MS;
        const hasPunctuation = sentenceEndRegex.test(line.text);

        console.log(`  Checking Conditions: durationMet=${durationMet}, hasPunctuation=${hasPunctuation}, isLastLineOverall=${isLastLineOverall}`); // LOG: Conditions

        if (durationMet) {
             console.log(`    Duration MET (${currentDuration} >= ${MIN_CHUNK_DURATION_MS})`); // LOG: Duration met
            if (hasPunctuation) {
                console.log(`    Punctuation FOUND in line ${line.index}`); // LOG: Punctuation found
                finalizeChunk = true;
            } else {
                console.log(`    Punctuation NOT found in line ${line.index}`); // LOG: No punctuation
            }
        } else {
             console.log(`    Duration NOT met (${currentDuration} < ${MIN_CHUNK_DURATION_MS})`); // LOG: Duration not met
        }

        if (isLastLineOverall) {
            console.log(`    Is Last Line Overall - Forcing Finalize`); // LOG: Last line
            finalizeChunk = true;
        }

        if (finalizeChunk && currentChunkLines.length > 0) {
            console.log(`  >>> FINALIZING CHUNK <<<`); // LOG: Finalizing
            console.log(`    Final Chunk Start Time: ${chunkStartTimeMs}`);
            console.log(`    Final Chunk End Time: ${chunkEndTimeMs}`);
            console.log(`    Final Chunk Text: "${chunkCombinedText.trim()}"`);
            const actualChunkStartTime = currentChunkLines[0].startTimeMs;
            searchEntries.push({
                id: `${episodeId}_${actualChunkStartTime}`,
                episodeId,
                episodeTitle,
                startTimeMs: actualChunkStartTime,
                endTimeMs: chunkEndTimeMs,
                text: chunkCombinedText.trim()
            });

            // Reset for next chunk
            currentChunkLines = [];
            chunkCombinedText = '';
            console.log(`  >>> Chunk Finalized & State Reset <<<`); // LOG: Reset
        } else {
            console.log(`  --- Not Finalizing Chunk ---`); // LOG: Not finalizing
        }
    } // End for loop

    console.log(`\n--- Chunking Complete for Episode ${episodeId} ---`); // LOG: End
    console.log(`Total search entries created: ${searchEntries.length}`);

    return searchEntries;
};
