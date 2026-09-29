import { useDispatch } from "react-redux";
import { useRef, useCallback, useState } from "react";
import { callPublishIvService } from "../redux/caseManagement/ivPublication/publicationSlice";

// Custom error for IV publishing operations
class PublishIvError extends Error {
  constructor(message, code, originalError = null) {
    super(message);
    this.name = "PublishIvError";
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

// HTTP status codes that warrant retry
const RETRYABLE_ERROR_CODES = [408, 429, 500, 502, 503, 504];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const calculateBackoffDelay = (attempt) => {
  const delay = RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
};

const isRetryableError = (error) => {
  if (!error) return false;

  const statusCode = error.response?.status || error.status;
  if (statusCode && RETRYABLE_ERROR_CODES.includes(statusCode)) {
    return true;
  }

  // Network errors are retryable
  if (error.message?.includes("Network Error") || error.code === "ECONNABORTED") {
    return true;
  }

  return false;
};

const retryWithBackoff = async (fn, maxRetries = RETRY_CONFIG.maxRetries) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === maxRetries || !isRetryableError(error)) {
        console.error(error);
      }

      // Calculate delay and wait before retrying
      const delayMs = calculateBackoffDelay(attempt);
      await delay(delayMs);
    }
  }

  throw lastError;
};

// Hook for publishing documents to IV with deduplication and retry support
export const usePublishIv = () => {
  const dispatch = useDispatch();

  // Track in-flight requests to prevent duplicates
  const inflightRequests = useRef(new Map());

  // Track active publish operations (state for React reactivity)
  const [isPublishing, setIsPublishing] = useState(false);

  const publish = useCallback(
    async (docId, options = {}) => {
      const { skipDeduplication = false, signal } = options;

      // Input validation
      if (!docId) {
        throw new PublishIvError("Document ID is required for IV publishing", "INVALID_INPUT");
      }

      if (typeof docId !== "string" || docId.trim().length === 0) {
        throw new PublishIvError("Document ID must be a non-empty string", "INVALID_INPUT");
      }

      // Check for duplicate request
      if (!skipDeduplication && inflightRequests.current.has(docId)) {
        return inflightRequests.current.get(docId);
      }

      // Create publish promise
      const publishPromise = (async () => {
        try {
          setIsPublishing(true);

          // Check if request was cancelled
          if (signal?.aborted) {
            throw new PublishIvError("Request was cancelled", "CANCELLED");
          }

          // Prepare payload
          const payload = {
            "run-stateless": "true",
            data: {
              variables: {
                doc_id: docId,
              },
            },
          };

          // Call publish IV service with retry logic
          let response;
          try {
            response = await retryWithBackoff(async () => {
              if (signal?.aborted) {
                throw new PublishIvError("Request was cancelled", "CANCELLED");
              }
              return await dispatch(callPublishIvService(payload)).unwrap();
            });
          } catch (publishError) {
            const errorMessage = publishError?.response?.data?.developerMessage || publishError?.message || "Unknown error occurred during IV publishing";

            throw new PublishIvError(`Failed to publish document to IV: ${errorMessage}`, "PUBLISH_ERROR", publishError);
          }

          // Extract publication ID
          const publicationId = response?.data?.variables?.op_publicationId;

          if (!publicationId) {
            throw new PublishIvError("Publication ID not returned from IV service", "MISSING_PUBLICATION_ID", response);
          }
          return publicationId;
        } catch (error) {
          // Re-throw PublishIvError as-is
          if (error instanceof PublishIvError) {
            console.error(error);
          }

          // Wrap other errors
          throw new PublishIvError(error.message || "Unknown error occurred", "UNKNOWN_ERROR", error);
        } finally {
          setIsPublishing(false);
          // Remove from inflight requests
          if (!skipDeduplication) {
            inflightRequests.current.delete(docId);
          }
        }
      })();

      // Store promise for deduplication
      if (!skipDeduplication) {
        inflightRequests.current.set(docId, publishPromise);
      }

      return publishPromise;
    },
    [dispatch],
  );

  return {
    publish,
    isPublishing,
  };
};
