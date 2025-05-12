import log from 'loglevel';

export const loggingLevel =
  typeof process !== 'undefined' && process.env && process.env.LOGGING_LEVEL
    ? process.env.LOGGING_LEVEL
    : 'warn';
log.setLevel(loggingLevel as log.LogLevelDesc);

export { log };
