We've implemented a series of Lambda triggers and a CloudFront cache invalidation:

1.  **Whisper Lambda (`packages/ingestion/process-audio-lambda/process-new-audio-files-via-whisper.ts`) triggers Indexing Lambda (`packages/ingestion/srt-indexing-lambda/convert-srt-files-into-indexed-search-entries.ts`):**
    *   Modified `process-new-audio-files-via-whisper.ts` in the `handler` function to invoke `convert-srt-files-into-indexed-search-entries` if new SRT transcript files were created.
    *   Relevant IAM permission (`allow_lambda2_to_invoke_lambda3`) was already present in `terraform/main.tf`.

2.  **RSS Retrieval Lambda (`packages/ingestion/rss-retrieval-lambda/retrieve-rss-feeds-and-download-audio-files.ts`) triggers Whisper Lambda (`packages/ingestion/process-audio-lambda/process-new-audio-files-via-whisper.ts`):**
    *   Modified `retrieve-rss-feeds-and-download-audio-files.ts`, specifically the `triggerTranscriptionLambda` function, to invoke `process-new-audio-files-via-whisper` if new MP3 audio files were downloaded, passing the S3 keys of the new files.
    *   Relevant IAM permission (`allow_lambda1_to_invoke_lambda2`) was already present in `terraform/main.tf`.

3.  **CloudFront Cache Invalidation for Episode Manifest:**
    *   Modified `retrieve-rss-feeds-and-download-audio-files.ts` in the `handler` function to call a new function `invalidateCloudFrontCacheForManifest` if new MP3 audio files were downloaded. This function invalidates the CloudFront cache for the `EPISODE_MANIFEST_KEY`.
    *   Terraform changes:
        *   Updated `terraform/main.tf`:
            *   Passed `CLOUDFRONT_DISTRIBUTION_ID` (value: `module.cloudfront.cloudfront_id`) as an environment variable to the `rss_lambda` module.
            *   Passed `cloudfront_distribution_arn` (value: `module.cloudfront.cloudfront_arn`) as a variable to the `rss_lambda` module.
        *   Updated `terraform/modules/lambda/variables.tf`: Added `cloudfront_distribution_arn` variable.
        *   Updated `terraform/modules/lambda/main.tf`:
            *   Added a new IAM policy resource `aws_iam_policy.cloudfront_invalidation` to allow `cloudfront:CreateInvalidation` action.
            *   Conditionally attached this policy to the Lambda execution role via `aws_iam_role_policy_attachment.lambda_cloudfront_invalidation` if `var.cloudfront_distribution_arn` is provided.

This ensures that new audio files are transcribed, indexed, and the client application (via CloudFront) is notified of updates to the episode manifest when new content is available.
