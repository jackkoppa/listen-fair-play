import * as fs from 'fs';
import * as path from 'path';
import SrtParser2 from 'srt-parser-2';

// TODO: Implement a linting function that takes in the contents of a .srt file, and determines if at any point, there are > 30 seconds with no punctuation. Return an error if so
// const lintSrtFile = (srtContent: string) => {
// }

const MAX_CHUNK_DURATION_MS = 30000;
const DURATION_TOLERANCE_MS = 1000; // Allow segments up to 1 second over the limit
const sentenceEndRegex = /[.!?][\s]*$/;

interface SrtLine {
    id: string;
    startTime: string;
    endTime: string;
    startSeconds: number;
    endSeconds: number;
    text: string;
}

interface LintError {
    filePath: string;
    exampleSegment: {
        text: string;
        duration: number;
        startTime: number;
        endTime: number;
    };
}

// Helper to convert HH:MM:SS,ms string to milliseconds
function timeStringToMs(timeString: string): number {
    const parts = timeString.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!parts) return 0;
    return (
        parseInt(parts[1], 10) * 3600000 + // hours
        parseInt(parts[2], 10) * 60000 +   // minutes
        parseInt(parts[3], 10) * 1000 +    // seconds
        parseInt(parts[4], 10)             // milliseconds
    );
}

export const lintSrtFile = (srtContent: string, filePath: string): LintError | null => {
    const parser = new SrtParser2();
    const srtEntries = parser.fromSrt(srtContent) as SrtLine[];

    if (srtEntries.length === 0) {
        return null;
    }

    let lastPunctuationTimeMs = timeStringToMs(srtEntries[0].startTime);

    for (const entry of srtEntries) {
        const entryStartTimeMs = timeStringToMs(entry.startTime);
        const entryEndTimeMs = timeStringToMs(entry.endTime);
        const segmentDurationNoPunctuation = entryEndTimeMs - lastPunctuationTimeMs;

        // Add tolerance to the duration check (allow segments slightly over the limit)
        if (segmentDurationNoPunctuation > MAX_CHUNK_DURATION_MS + DURATION_TOLERANCE_MS) {
            return {
                filePath,
                exampleSegment: {
                    text: entry.text.trim().replace(/\r?\n/g, ' '),
                    duration: segmentDurationNoPunctuation,
                    startTime: timeStringToMs(entry.startTime),
                    endTime: entryEndTimeMs,
                },
            };
        }

        if (sentenceEndRegex.test(entry.text.trim())) {
            lastPunctuationTimeMs = entryEndTimeMs;
        }
    }
    return null; // No linting errors found
};

// TODO: Implement. This will be the function we call from root /package.json
export const lintAllSrtFiles = (srtDirectory: string): LintError[] => {
    const failingFiles: LintError[] = [];
    
    function findSrtFilesRecursive(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                findSrtFilesRecursive(fullPath);
            } else if (path.extname(entry.name).toLowerCase() === '.srt') {
                try {
                    const srtContent = fs.readFileSync(fullPath, 'utf8');
                    const error = lintSrtFile(srtContent, fullPath);
                    if (error) {
                        failingFiles.push(error);
                    }
                } catch (readError) {
                    console.error(`Error reading or linting file ${fullPath}:`, readError);
                }
            }
        }
    }

    if (fs.existsSync(srtDirectory)) {
        findSrtFilesRecursive(srtDirectory);
    } else {
        // This case should ideally be handled by the calling script,
        // but adding a guard here too.
        console.warn(`SRT directory ${srtDirectory} does not exist. Skipping linting for this path.`);
    }

    return failingFiles;
};
