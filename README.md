# listen, fair play

Searchable archive of Football Cliches podcast episodes

> [!NOTE]  
> Very much a WIP. Heavily Cursor-assisted.

## Project Structure

This project consists of multiple parts:
- `/client` - Frontend application 
- `/processing` - Podcast RSS feed processing system

## Prerequisites

- Node.js 22 or later (we recommend using [nvm](https://github.com/nvm-sh/nvm) to manage Node versions)
- pnpm 8 or later

If you have nvm installed, you can set up the correct Node version with:
```shell
nvm use
```

## Local Development

### Quick Setup

We provide a setup script that checks for the required tools and sets up everything you need:

```shell
# Clone the repository
git clone git@github.com:jackkoppa/listen-fair-play.git
cd listen-fair-play

# Run the setup script (requires nvm)
bash scripts/setup.sh
```

### Manual Setup

```shell
# Use the correct Node version
nvm use
# Install pnpm if you don't have it
npm install -g pnpm

# Clone and set up the project
git clone git@github.com:jackkoppa/listen-fair-play.git
cd listen-fair-play
pnpm install:all

# Run the client
pnpm dev:client

# Run the RSS feed processing
pnpm dev:rss

# Run the Whisper transcription 
pnpm dev:whisper

# view client @ http://localhost:5173
```

## Processing Module

The processing module handles retrieving podcast RSS feeds, downloading audio files, and transcribing content.

```shell
# Run the RSS feed retrieval and audio download process
pnpm dev:rss

# Run the Whisper transcription process
pnpm dev:whisper

# Build the Lambda functions for deployment
pnpm build:processing
```

See the [processing README](./processing/README.md) for more details.