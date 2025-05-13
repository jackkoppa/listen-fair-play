# Podcast RSS Processing System

This system retrieves podcast RSS feeds, downloads audio files, and eventually transcribes them using OpenAI's Whisper API.

## Prerequisites

- Node.js 20 or later (use [nvm](https://github.com/nvm-sh/nvm) to easily switch Node versions)
- pnpm 10 or later

If you have nvm installed, you can set up the correct Node version with:
```shell
nvm use
```

## Directory Structure

- `/rss`: Contains RSS feed configuration and downloaded XML files
- `/audio`: Stores downloaded audio files from podcasts
- `/transcripts`: Contains transcribed SRT files (from Whisper API)
- `/lamdas`: AWS Lambda functions for processing

## Setup

1. Make sure you're using Node 20:
```
nvm use
```

2. Install dependencies:
```
pnpm install
```

3. Make sure the RSS feed configuration is set up properly in `/rss/rss-feeds-config.json`.

## Running Locally

To run the RSS feed retrieval and audio download process:

```
pnpm run-rss:local

# to instead actually populate files to S3:
pnpm run-rss:dev-s3
```

This will:
1. Fetch RSS feeds for active podcasts in the config
2. Save the updated RSS XML files
3. Check for any new podcast episodes
4. Download any new episodes to the `/audio` directory
5. Update timestamps in the config file

To run the audio file transcription process:

```
pnpm run-whisper:local

# to instead actually populate files to S3:
pnpm run-whisper:dev-s3
```

This will:
1. Process audio files in the `/audio` directory
2. Create transcriptions using OpenAI's Whisper API
3. Save SRT files to the `/transcripts` directory

## AWS Lambda Deployment

For deployment to AWS Lambda:

1. Build the TypeScript files:
```
pnpm build
```

2. The compiled JavaScript files will be in the `/dist` directory
3. Upload the contents of the `/dist/lamdas` directory to AWS Lambda
4. Configure environment variables as needed

## Lambda Functions

1. `retrieve-rss-feeds-and-download-audio-files.ts` (Lambda-1)
   - Retrieves RSS feeds and downloads new audio files

2. `process-new-audio-files-via-whisper.ts` (Lambda-2)
   - Processes audio files via OpenAI Whisper API
   - Creates SRT transcript files 