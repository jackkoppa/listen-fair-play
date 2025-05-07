// Copies /processing/utils/logging.ts

import log from 'loglevel';

export const loggingLevel = process.env.LOGGING_LEVEL || 'warn';
log.setLevel(loggingLevel as log.LogLevelDesc);

export { log };
