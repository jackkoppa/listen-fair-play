# Listen Fair Play

A podcast archiving and searching application:
1. Retrieves podcast RSS feeds
2. Downloads audio files
3. Transcribes audio using OpenAI's Whisper API
4. Provides a search interface for transcripts

## Project Structure

- `/client`: React web application for searching transcripts
- `/processing`: AWS Lambda functions for podcast processing
  - `retrieve-rss-feeds-and-download-audio-files.ts`: Retrieves RSS feeds and downloads audio
  - `process-new-audio-files-via-whisper.ts`: Transcribes audio files via Whisper API
- `/diagrams`: Architecture diagrams
  - `aws-architecture.drawio`: DrawIO diagram of AWS infrastructure
  - `architecture-text.md`: Text-based description of architecture

## AWS Architecture

The system is deployed on AWS using a serverless architecture:

1. **EventBridge Scheduler** triggers the RSS feed Lambda daily
2. **Lambda 1** retrieves podcast RSS feeds and downloads new audio files
3. **Lambda 2** processes audio files via OpenAI Whisper API for transcription
4. **Amazon S3** stores all audio, transcriptions, and hosts the client application
5. **CloudFront** delivers all content to users

For a detailed view of the architecture:
- Open `diagrams/aws-architecture.drawio` with [draw.io](https://app.diagrams.net/)
- View the text-based description in `diagrams/architecture-text.md`

## Local Development

See the processing README for details on local development:
- [Processing README](/processing/README.md)

## Deployment

*Coming soon: Terraform configuration and GitHub Actions deployment*