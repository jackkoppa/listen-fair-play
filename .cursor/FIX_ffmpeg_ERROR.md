# Background

We have been using this NPM package for splitting apart files: https://www.npmjs.com/package/fluent-ffmpeg

In this file: /packages/ingestion/process-audio-lambda/process-new-audio-files-via-whisper.ts

However, we never successfully tested that NPM package approach in Lambda - only locally.
Once we tested on Lambda, it was failing with this error:

```
2025-06-02T17:14:26.150Z	fa9a7eb5-b5e9-4b54-962a-a57fe6cd525d	ERROR	Error processing file audio/football-cliches/2025-05-28_Proper-clubs-&--woke-pressing--with-the-Screen-Rot.mp3: ReferenceError: __dirname is not defined
    at new FfmpegCommand (file:///var/task/process-new-audio-files-via-whisper.js:3500:71)
    at FfmpegCommand.ffprobe (file:///var/task/process-new-audio-files-via-whisper.js:3609:18)
    at file:///var/task/process-new-audio-files-via-whisper.js:94219:32
    at new Promise (<anonymous>)
    at splitAudioFile (file:///var/task/process-new-audio-files-via-whisper.js:94216:9)
    at async processAudioFile (file:///var/task/process-new-audio-files-via-whisper.js:94324:12)
    at async Runtime.handler (file:///var/task/process-new-audio-files-via-whisper.js:94416:3)
```

Which is because the NPM package relies on binaries getting built during install, for the system it's on.

Once I started to look into this, I realized that the NPM package itself has been deprecated & the repository archived:
https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1324

(this was pretty recent)

So let's not build off of that. Instead, let's use the native `ffmpeg` library, and let's make sure it's installed on the user's machine when running locally, and on Lambda via Lambda Layers.

Here's the steps I'd like you to take:

1. Move this whole section of `process-new-audio-files-via-whisper.ts`, that relates to ffmpeg, to a utils file in that package. Can make it something like `ffmpeg-utils.ts`, or some other name

2. Add specs that cover the functionality that we'll be adding to that utility function

3. Replace our usage of `fluent-ffmpeg`, and instead call the CLI `ffmpeg` directly. This might get a bit complex, so reference the docs as necessary: https://ffmpeg.org/ffmpeg.html

4. Make sure to, in that util, throw an error early (that gives instructions for local installation, and/or Lambda Layers) if the `ffmpeg` functionality is not available as expected

5. Once `fluent-ffmpeg` has been fully replaced, stop and let me know - so that I can re-test `pnpm process-audio-lambda:run:local` locally to make sure it's still working the same. Update what you've done so far in this doc.

---

6. After that checkpoint, proceed to make sure the Lambda Layer for `ffmpeg` is correctly configured in Terraform. I've gotten us started by already downloading the .tar & documenting a bit here:
terraform/lambda-layers/README.md
But you'll need to update Terraform for the Layer

7. Prompt me to test actually running this on Lambda then - if things are working, then this effort is complete!

--- AGENT: DO NOT EDIT ABOVE THIS LINE ---

--- AGENT: EDIT BELOW THIS LINE, WITH PROGRESS NOTES AND/OR KEY DETAILS/FILES ---

## ✅ COMPLETED: Steps 1-5 - FFmpeg Migration

### Key Changes Made:
1. **Created `ffmpeg-utils.ts`** - New utility module with native CLI ffmpeg calls:
   - `checkFfmpegAvailability()` - Validates ffmpeg/ffprobe installation with helpful error messages
   - `getAudioMetadata()` - Uses `ffprobe` CLI to get audio duration/metadata  
   - `createAudioChunk()` - Uses `ffmpeg` CLI to split audio files into chunks
   - `splitAudioFile()` - Main function for splitting large audio files
   - `prepareAudioFile()` - Prepares small files for processing

2. **Created comprehensive test suite** - `ffmpeg-utils.spec.ts` with:
   - Mocked child_process spawn calls
   - Tests for success/failure scenarios 
   - Error handling and cleanup verification
   - 11 test cases covering all functionality

3. **Updated main file** - `process-new-audio-files-via-whisper.ts`:
   - Removed all `fluent-ffmpeg` imports and usage
   - Updated to use new ffmpeg-utils functions
   - Maintained same functionality with CLI-based approach

4. **Removed deprecated dependencies**:
   - Removed `fluent-ffmpeg` and `@types/fluent-ffmpeg` from package.json
   - Added `vitest` for testing framework

5. **Added error handling** - Clear installation instructions for:
   - Local development (macOS: `brew install ffmpeg`, Ubuntu, Windows)
   - Lambda deployment (Lambda Layer configuration)

### Status: Ready for Checkpoint Testing
The fluent-ffmpeg dependency has been completely replaced with native CLI calls. 
Please test `pnpm process-audio-lambda:run:local` to verify functionality before proceeding to Lambda Layer configuration.

### Next Steps (Pending Testing):
6. Configure Lambda Layer for ffmpeg in Terraform
7. Test on actual Lambda deployment