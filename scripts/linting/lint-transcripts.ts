// Transcript linting script to find SRT files with lengthy sections without proper punctuation

import SrtParser from "srt-parser-2";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// Directory containing transcript files
const TRANSCRIPTS_DIR = path.resolve(__dirname, "../../aws-local-dev/s3/transcripts");
const sentenceEndRegex = /[.!?]$/;

// Interface for SRT items from the parser
interface SrtItem {
  id: string;
  startTime: string;
  endTime: string;
  text: string;
}

// Get timestamp in seconds
function getTimeInSeconds(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(":")
    .map((part, index) => {
      // For seconds part, handle milliseconds
      if (index === 2 && part.includes(",")) {
        const [secs, ms] = part.split(",");
        return parseFloat(secs) + parseFloat(ms) / 1000;
      }
      return parseFloat(part);
    });
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Find all SRT files recursively
async function findSrtFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  
  async function traverse(directory: string) {
    const files = await readdir(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const fileStat = await stat(filePath);
      
      if (fileStat.isDirectory()) {
        await traverse(filePath);
      } else if (path.extname(file).toLowerCase() === ".srt") {
        result.push(filePath);
      }
    }
  }
  
  await traverse(dir);
  return result;
}

// Check a file for lint issues
async function lintFile(filePath: string): Promise<{ passes: boolean; failingText?: string }> {
  try {
    const fileContent = await readFile(filePath, "utf-8");
    const parser = new SrtParser();
    const data = parser.fromSrt(fileContent);
    
    let lastPunctuatedItem: SrtItem | null = null;
    
    for (let i = 0; i < data.length; i++) {
      const currentItem = data[i];
      const currentText = currentItem.text.trim();
      
      // Check if the current item ends with sentence-ending punctuation
      if (sentenceEndRegex.test(currentText)) {
        lastPunctuatedItem = currentItem;
        continue;
      }
      
      // If we don't have a previous punctuated item, continue
      if (!lastPunctuatedItem) {
        continue;
      }
      
      // Calculate time difference between last punctuated item and current item's end time
      const lastPunctuatedTime = getTimeInSeconds(lastPunctuatedItem.startTime);
      const currentEndTime = getTimeInSeconds(currentItem.endTime);
      
      // If the gap is >= 30 seconds, this file fails the lint check
      if (currentEndTime - lastPunctuatedTime >= 30) {
        // Collect text from the last punctuated item to the current item for the example
        const startIndex = data.findIndex(item => item.id === lastPunctuatedItem!.id);
        const failingText = data.slice(startIndex, i + 1)
          .map(item => item.text)
          .join(" ");
        
        return {
          passes: false,
          failingText: `Time range: ${lastPunctuatedItem.startTime} - ${currentItem.endTime} (${Math.round(currentEndTime - lastPunctuatedTime)}s)\n${failingText}`
        };
      }
    }
    
    // If we get here, the file passed
    return { passes: true };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return { passes: false, failingText: `Error processing file: ${error}` };
  }
}

async function main() {
  try {
    // Find all SRT files
    const srtFiles = await findSrtFiles(TRANSCRIPTS_DIR);
    console.log(`Found ${srtFiles.length} SRT files to check.`);
    
    // Lists to track passing and failing files
    const passingFiles: string[] = [];
    const failingFiles: { path: string; example: string }[] = [];
    
    // Process each file
    for (const file of srtFiles) {
      const relativePath = path.relative(TRANSCRIPTS_DIR, file);
      const result = await lintFile(file);
      
      if (result.passes) {
        passingFiles.push(relativePath);
      } else {
        failingFiles.push({
          path: relativePath,
          example: result.failingText || "Unknown issue"
        });
      }
    }
    
    // Output results
    console.log("\n========== LINT RESULTS ==========");
    console.log(`\nPassing Files (${passingFiles.length}):`);
    passingFiles.forEach(file => console.log(`✅ ${file}`));
    
    console.log(`\nFailing Files (${failingFiles.length}):`);
    failingFiles.forEach(file => {
      console.log(`❌ ${file.path}`);
      console.log(`   Example:`);
      console.log(`   ${file.example.replace(/\n/g, "\n   ")}`);
      console.log();
    });
    
    console.log("\n================================");
    console.log(`Total files checked: ${srtFiles.length}`);
    console.log(`Passing: ${passingFiles.length}`);
    console.log(`Failing: ${failingFiles.length}`);
    
    // Exit with error code if any files fail
    process.exit(failingFiles.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("Error running lint script:", error);
    process.exit(1);
  }
}

// Run the script
main();

