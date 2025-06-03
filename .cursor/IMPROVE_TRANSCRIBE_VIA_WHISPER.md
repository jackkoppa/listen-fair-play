# Implementation Plan: Improve Transcribe Via Whisper

## Overview
Enhance the transcription system with robust retry logic and multiple API provider options to handle timeouts/connection issues and provide fallback alternatives.

## 1. Retry Logic Implementation
- Add configurable retry constants (MAX_RETRIES = 2, TIMEOUT_MS = 60000)
- Create generic retry wrapper function with exponential backoff
- Apply to all API providers (OpenAI, Replicate, Deepgram)
- Handle specific error types: timeout, ECONNRESET, rate limiting

## 2. API Provider Implementations

### OpenAI (existing - enhance with retries)
- Add retry logic to existing implementation
- Handle timeout and connection reset errors specifically

### Replicate 
- Implement prediction-based API workflow
- Submit transcription job via POST to /v1/predictions
- Poll for completion with configurable intervals
- Handle async prediction lifecycle (starting -> processing -> succeeded/failed)
- Use model version from docs: whisper latest

### Deepgram
- Implement straightforward HTTP POST API similar to OpenAI
- Use whisper model with configurable size (medium default)
- Support same response formats (srt, json)
- Handle file streaming upload

## 3. Configuration & Environment
- Add API keys and config to temp-env-constants.ts:
  - REPLICATE_API_KEY
  - DEEPGRAM_API_KEY  
  - RETRY_MAX_ATTEMPTS
  - RETRY_TIMEOUT_MS
  - REPLICATE_POLL_INTERVAL_MS

## 4. Testing Strategy
- Mock HTTP requests for all providers
- Test retry logic with simulated failures
- Test timeout handling
- Test response format consistency across providers
- Integration tests for each provider

## 5. Error Handling
- Standardize error messages across providers
- Differentiate between retryable and non-retryable errors
- Add proper logging for debugging

## 6. File Structure
- Keep main transcribeViaWhisper function as single entry point
- Separate provider implementations into clear functions
- Add shared utilities for retry logic and error handling

## Key Docs & References
- Replicate Whisper API: https://replicate.com/openai/whisper/api
- Deepgram Whisper Cloud: https://developers.deepgram.com/docs/deepgram-whisper-cloud
- Current implementation: packages/ingestion/process-audio-lambda/utils/transcribe-via-whisper.ts