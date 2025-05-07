// Similar to /processing/utils/logging.ts & /search/utils/logging.ts

import log from 'loglevel';

// Update manually to the desired log level
// Future enhancement: use env variable, similar to /processing/utils/logging.ts & /search/utils/logging.ts
export const loggingLevel: log.LogLevelDesc = 'warn';

export { log };
