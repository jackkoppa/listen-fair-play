# Background

We're moving all linting into `/packages/linting`, and we're also writing a *new* linting function,
that will check all file names in S3.

New linting method will go here: 
`packages/linting/lint-s3-files-metadata.ts`

Relevant files to examine:

* `packages/linting/package.json`
* `package.json`
* Directory structure only of `aws-local-dev/s3`

General notes:
* Use `pnpm`
* Will need to add spec(s)
* `pnpm all:build` if we need to build all `packages/`
* important that the linting scripts we add can be run against `:local` (i.e. files saved in `aws-local-dev/s3`) OR AWS S3 (see other scripts that run with `:dev-s3` in package.json)


### Answers to initial questions

RSS Feed Source: Should I parse RSS feeds directly from the URLs in RSS_CONFIG, or use the already-parsed episode manifest as the source of truth? The manifest seems like the better source since it's already normalized.
    A: Use the downloaded RSS feed, from the URLs in RSS_CONFIG. Because you'll need to compare the computed fileKeys from that feed, with what's currently in `full-episode-manifest.json` - that needs to be linted as well.
File Key Matching: When checking if files match getEpisodeFileKey() output, should I:
    Strip the file extension before comparing? (e.g., compare 2020-01-23_The-Transfer-Window vs 2020-01-23_The-Transfer-Window.mp3)
        A: For each file type, compare the full file name to what's expected, i.e. is it `2020-01-23_The-Transfer-Window.mp3` as expected
    Handle cases where files might have slightly different naming patterns?
        A: Nope - all files should be of the format `fileKey.extension` - they should all have the same `fileKey`
Orphaned File Detection: For files that don't match any expected episode, what's the criteria for marking them as "should be removed"? Should I:
    Flag any file that doesn't correspond to a manifest episode?
        A: Yup, flag every file that doesn't match that
    Have exceptions for certain file types (like .DS_Store, directory markers, etc.)?
        A: No exceptions
Fix Application: When applyFixes = true, what types of fixes should be applied automatically?
    Unicode normalization fixes (rename files to NFC)?
        A: If the matching file exists, but just hasn't had `.normalize('NFC')` applied, then just update the name of the file to what it should be (i.e. with `normalize` applied)
    Remove confirmed orphaned files?
        A: Yup, remove orphaned files
    Update the episode manifest?
        A: Yup, update the episode manifest if any of the entries are wrong
    A: IMPORTANT: When running from the CLI with `applyFixes = true`, we should first output all the updates that would be applied, and then give the user the option to opt in or out of actually running those fixes (e.g. "these files will be deleted, these will be renamed, do you want to apply that?")
Environment Scope: Should this linter work against both :local (files in aws-local-dev/s3) and :dev-s3/:prod-s3 environments, similar to other scripts? I see the requirement mentions both.
    A: Yup, should be able to run against both types of environments



--- AGENT - DO NOT EDIT ABOVE THIS LINE, ONLY EDIT BELOW THIS LINE ---

# Implementation Plan

## Overview
Create a comprehensive S3 file metadata linter that validates all podcast files against RSS feeds and ensures proper file naming, structure, and completeness.

## Core Logic Flow

### 1. Data Collection Phase
- **Parse RSS Feeds**: Download and parse RSS feeds from `RSS_CONFIG` URLs (not from manifest)
- **Load Episode Manifest**: Read `episode-manifest/full-episode-manifest.json`
- **Scan S3 Files**: List all files in `audio/`, `transcripts/`, `search-entries/` directories

### 2. Validation Phase
For each episode in RSS feeds:
- **Generate Expected File Key**: Use `getEpisodeFileKey(episodeTitle, pubDateStr)`
- **Check Required Files Exist**:
  - `audio/{podcastId}/{fileKey}.mp3`
  - `transcripts/{podcastId}/{fileKey}.srt` 
  - `search-entries/{podcastId}/{fileKey}.json`
- **Validate Manifest Entry**: Ensure episode exists in manifest with correct fileKey
- **Check Unicode Normalization**: Verify all file names are valid UTF-8 (NFC)

### 3. Issue Detection
- **Missing Files**: RSS episodes without corresponding S3 files
- **Incorrect File Names**: Files that don't match expected `getEpisodeFileKey()` output
- **Unicode Issues**: Files that match when normalized but aren't properly normalized
- **Orphaned Files**: S3 files that don't correspond to any RSS episode
- **Manifest Issues**: Entries in manifest that don't match RSS feed data

### 4. Fix Application (when `applyFixes = true`)
- **Preview Changes**: Show all proposed fixes to user
- **User Confirmation**: Require explicit approval before applying changes
- **Apply Fixes**:
  - Rename files for Unicode normalization
  - Remove orphaned files
  - Update episode manifest with correct data

## Interface Design

```typescript
interface LintResult {
  issues: LintIssue[];
  summary: LintSummary;
  hasErrors: boolean;
}

interface LintIssue {
  type: 'missing-file' | 'incorrect-filename' | 'unicode-issue' | 'orphaned-file' | 'manifest-mismatch';
  severity: 'error' | 'warning';
  description: string;
  episodeInfo?: {
    podcastId: string;
    title: string;
    fileKey: string;
  };
  filePath?: string;
  expectedPath?: string;
  fixAction?: 'rename' | 'delete' | 'create' | 'update-manifest';
}
```

## Environment Support
- Support both `:local` (aws-local-dev/s3) and `:dev-s3`/`:prod-s3` environments
- Use existing S3 utilities from `@listen-fair-play/s3` package
- Respect `FILE_STORAGE_ENV` environment variable

## CLI Integration
- Add script to `packages/linting/package.json`: `"lint:s3-files-metadata": "tsx ./lint-s3-files-metadata.ts"`
- Add script to root `package.json` with environment options:
  - `"lint:s3-metadata:local": "FILE_STORAGE_ENV=local pnpm --filter @listen-fair-play/linting lint:s3-files-metadata"`
  - `"lint:s3-metadata:dev-s3": "FILE_STORAGE_ENV=dev-s3 pnpm --filter @listen-fair-play/linting lint:s3-files-metadata"`

## Implementation Steps
1. ✅ Write implementation plan
2. 🔄 Implement core linting logic
3. 🔄 Add RSS feed parsing integration  
4. 🔄 Add file validation and issue detection
5. 🔄 Implement fix application with user confirmation
6. 🔄 Add CLI entry point and error handling
7. 🔄 Write comprehensive tests
8. 🔄 Update package.json scripts
