// user will move constants from here to appropriate .env files
export const EXAMPLE_TEMP_VAR = 'example-temp-var';

// Transcription API Configuration
export const REPLICATE_API_KEY = 'your-replicate-api-key-here';
export const DEEPGRAM_API_KEY = 'your-deepgram-api-key-here';

// Retry Configuration
export const RETRY_MAX_ATTEMPTS = 3; // Total attempts (1 initial + 2 retries)
export const RETRY_TIMEOUT_MS = 60000; // 60 seconds
export const RETRY_BASE_DELAY_MS = 1000; // Base delay for exponential backoff
export const REPLICATE_POLL_INTERVAL_MS = 2000; // Polling interval for Replicate predictions