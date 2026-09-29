// Structured logger with environment-based log levels (DEBUG in dev with VITE_DEBUG_LOGGING=1, WARN+ in prod)


const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Determine log level from environment
const getLogLevel = () => {
  if (import.meta.env.PROD) {
    return LOG_LEVELS.WARN;
  }
  // Development: default to WARN to avoid console spam. Set VITE_DEBUG_LOGGING=1 to enable debug.
  const explicitDebug = import.meta.env.VITE_DEBUG_LOGGING;
  if (explicitDebug === "1" || explicitDebug === "true") {
    return LOG_LEVELS.DEBUG;
  }
  return LOG_LEVELS.WARN;
};

const currentLogLevel = getLogLevel();

const shouldLog = (level) => level >= currentLogLevel;

/**
 * Structured logger with log levels
 */
export const log = {
  debug: (message, data = {}) => {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[DEBUG] ${message}`, data);
    }
  },

  info: () => {
    // INFO logs are disabled to reduce console noise
    // Use log.debug() for development logs or log.warn() for important notices
  },

  warn: (message, data = {}) => {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[WARN] ${message}`, data);
    }
  },

  error: (message, error = null, data = {}) => {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      const errorData = error ? { error: error.message || String(error), stack: error.stack, ...data } : data;
      console.error(`[ERROR] ${message}`, errorData);
    }
  }
};

