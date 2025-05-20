import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { lintAllSrtFiles } from '../packages/linting/dist/index.js';

// TODO: consider getting this from .env.local
const SRT_DIRECTORY = path.join(process.cwd(), 'aws-local-dev', 's3', 'transcripts');
// const SRT_DIRECTORY = path.join(process.cwd(), 'temp-srt-files'); // For testing

async function main() {
    console.log(`Linting .srt files in ${SRT_DIRECTORY}...`);

    if (!fs.existsSync(SRT_DIRECTORY)) {
        console.error(`Error: SRT directory does not exist: ${SRT_DIRECTORY}`);
        console.log('Please ensure you have downloaded or created SRT files in the expected location.');
        console.log('If you have S3 files, you might need to run a script like ./scripts/TEMP-download-all-bucket-objects-to-local.sh first, ');
        console.log(`and ensure it places .srt files into the above directory (or a subdirectory like 'transcripts/srt/' within the backup folder).`);
        process.exit(1);
    }

    const failingFiles = lintAllSrtFiles(SRT_DIRECTORY);

    if (failingFiles.length === 0) {
        console.log('✅ All SRT files passed linting.');
        process.exit(0);
    }

    console.log('\n❌ Linting failed for the following files:');
    const filesToDelete: string[] = [];
    for (const failure of failingFiles) {
        filesToDelete.push(failure.filePath);
        console.log(`\nFile: ${failure.filePath}`);
        console.log(`  Problematic segment (duration: ${failure.exampleSegment.duration}ms):`);
        console.log(`    Start Time: ${new Date(failure.exampleSegment.startTime).toISOString().slice(11, 23)}`);
        console.log(`    End Time:   ${new Date(failure.exampleSegment.endTime).toISOString().slice(11, 23)}`);
        console.log(`    Text: "${failure.exampleSegment.text}"`);
    }

    console.log('\n--- ACTION REQUIRED ---');
    const { confirmRetranscribe } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmRetranscribe',
            message: `Found ${failingFiles.length} file(s) with linting issues. Would you like to delete these files and attempt to re-transcribe them by running 'pnpm process-audio-lambda:run:local'?`,
            default: false,
        },
    ]);

    if (confirmRetranscribe) {
        console.log('\nProceeding with deletion and re-transcription...');
        for (const filePath of filesToDelete) {
            try {
                fs.unlinkSync(filePath);
                console.log(`  Deleted: ${filePath}`);
            } catch (err) {
                console.error(`  Error deleting ${filePath}:`, err);
            }
        }

        console.log('\nStarting re-transcription process (pnpm process-audio-lambda:run:local)...');
        try {
            execSync('pnpm process-audio-lambda:run:local', { stdio: 'inherit' });
            console.log('✅ Re-transcription process initiated.');
        } catch (error) {
            console.error('❌ Failed to start re-transcription process:', error);
        }
    } else {
        console.log('Operation cancelled by the user. No files were deleted or re-transcribed.');
    }

    process.exit(0);
}

main().catch(error => {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
}); 