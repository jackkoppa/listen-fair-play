// Copies /processing/utils/logging.ts
// CURSOR-TODO: Move to a root /constants package, so it can be shared

import log from 'loglevel';

export const loggingLevel = process.env.LOGGING_LEVEL || 'warn';
log.setLevel(loggingLevel as log.LogLevelDesc);

export { log };
