# aws-local-dev

In this directory (which aside from this README, is gitignored), we save local files that will be available from AWS for production deployments (primarily S3)

During local dev, those resources are retrieved from here _instead of_ AWS.

## S3

Expected structure of S3 Bucket

/aws-local-dev # should match S3 bucket structure in prod
|--s3
   |--manifest
   |  |--episodes.manifest.json
   |     # Tracking all retrieved episodes, and the status for   
   |       each (e.g. audio retrieved, transcribed, indexed, etc.)
   |--rss
   |  # RSS feeds retrieved based on /podcasts.manifest.json
   |--audio
   |  # .mp3 files for retrieved episodes
   |--transcripts
   |  # .srt files for transcribed episodes
