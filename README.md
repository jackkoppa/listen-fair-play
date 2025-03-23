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
- `/terraform`: Terraform configurations for AWS infrastructure
- `/scripts`: Utility scripts for local development and deployment

## AWS Architecture

See [`diagrams/README.md`](./diagrams/README.md)

## Local Development

- For developing the React web appplication, see [`client/README.md`](/client/README.md)
- For developing Lambda functions, see [`processing/README.md`](/processing/README.md)

## Deployment

This project uses Terraform for deploying infrastructure to AWS. The deployment process is managed locally through shell scripts.

### Prerequisites

To deploy this application, you'll need:

1. [Terraform](https://developer.hashicorp.com/terraform/install) (>= 1.0.0)
2. [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
3. Node.js 22 or later
4. pnpm 8 or later

For detailed installation and configuration instructions, see [scripts/deploy/README.md](./scripts/deploy/README.md).

### Configuration

1. Create a `.env.local` file in the project root:
   ```bash
   cp .env.local.example .env.local
   ```

2. Add your AWS credentials and OpenAI API key to `.env.local`

### Deployment Commands

```bash
# Deploy to development environment
./scripts/deploy/deploy.sh dev

# Deploy to production environment
./scripts/deploy/deploy.sh prod

# Destroy an environment (use with caution!)
./scripts/deploy/destroy.sh dev
```

For more detailed deployment instructions, troubleshooting, and configuration options, see [scripts/deploy/README.md](./scripts/deploy/README.md).