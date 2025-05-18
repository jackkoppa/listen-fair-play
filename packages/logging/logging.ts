import log from 'loglevel';

export const logLevel =
  typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL
    ? process.env.LOG_LEVEL
    : 'warn';
log.setLevel(logLevel as log.LogLevelDesc);

export { log };