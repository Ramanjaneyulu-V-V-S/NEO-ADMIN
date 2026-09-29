// AES-GCM encryption for markups in localStorage using session-scoped keys


import { log } from '../../../iframe/utils/logger';

// Session-scoped encryption key (generated once per page load, stored in memory only)
let sessionEncryptionKey = null;
let keyGenerationPromise = null;

/**
 * Generate a session-scoped encryption key
 * Key is derived from origin + session ID, stored only in memory
 * @returns {Promise<CryptoKey>} Encryption key
 */
async function getSessionEncryptionKey() {
  // Return cached key if already generated
  if (sessionEncryptionKey) {
    return sessionEncryptionKey;
  }

  // Return existing promise if key generation is in progress
  if (keyGenerationPromise) {
    return keyGenerationPromise;
  }

  // Generate new key
  keyGenerationPromise = (async () => {
    try {
      // Check if Web Crypto API is available
      if (!globalThis.crypto?.subtle) {
        log.warn('[MarkupEncryption] Web Crypto API not available - encryption disabled');
        return null;
      }

      // Generate a session identifier (unique per page load)
      const sessionId = `session_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`;
      const origin = globalThis.location.origin || 'unknown';

      // Derive key material from origin + session ID
      // Using PBKDF2 to derive a key from the combination
      const keyMaterial = `${origin}_${sessionId}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(keyMaterial);

      // Import key material and derive encryption key using PBKDF2
      const baseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      // Derive AES-GCM key from base key
      const salt = encoder.encode('brava-markup-encryption-salt'); // Fixed salt for key derivation
      const encryptionKey = await globalThis.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000, // High iteration count for security
          hash: 'SHA-256',
        },
        baseKey,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['encrypt', 'decrypt']
      );

      sessionEncryptionKey = encryptionKey;
      return encryptionKey;
    } catch (error) {
      log.error('[MarkupEncryption] Error generating encryption key', error);
      return null;
    }
  })();

  return keyGenerationPromise;
}

/**
 * Encrypt markup data using AES-GCM
 * @param {Array} markups - Array of markup objects to encrypt
 * @returns {Promise<string|null>} Encrypted data as base64 string, or null if encryption fails
 */
export async function encryptMarkups(markups) {
  if (!markups || !Array.isArray(markups) || markups.length === 0) {
    return null;
  }

  try {
    const key = await getSessionEncryptionKey();
    if (!key) {
      // Web Crypto not available - return null (caller should handle gracefully)
      log.warn('[MarkupEncryption] Encryption key not available - cannot encrypt markups');
      return null;
    }

    // Convert markups to JSON string
    const plaintext = JSON.stringify(markups);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate random IV (12 bytes for AES-GCM)
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt using AES-GCM
    const encrypted = await globalThis.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );

    // Combine IV and encrypted data, then encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64 for storage (chunked approach to handle large arrays)
    // Using chunked conversion to avoid stack overflow with spread operator
    let binaryString = '';
    const chunkSize = 8192; // Process in chunks
    for (let i = 0; i < combined.length; i += chunkSize) {
      const chunk = combined.slice(i, i + chunkSize);
      // Convert chunk to array for apply() - handle both small and large chunks safely
      const chunkArray = Array.from(chunk);
      binaryString += String.fromCodePoint.apply(null, chunkArray);
    }
    const base64 = btoa(binaryString);
    return base64;
  } catch (error) {
    log.error('[MarkupEncryption] Error encrypting markups', error);
    return null;
  }
}

/**
 * Decrypt markup data using AES-GCM
 * @param {string} encryptedData - Encrypted data as base64 string
 * @returns {Promise<Array|null>} Decrypted markups array, or null if decryption fails
 */
export async function decryptMarkups(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return null;
  }

  try {
    const key = await getSessionEncryptionKey();
    if (!key) {
      // Web Crypto not available - try to parse as plain JSON (backward compatibility)
      log.warn('[MarkupEncryption] Encryption key not available - attempting plain JSON parse');
      try {
        return JSON.parse(encryptedData);
      } catch (parseError) {
        log.error('[MarkupEncryption] Failed to parse as plain JSON', parseError);
        return null;
      }
    }

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.codePointAt(0));

    // Extract IV (first 12 bytes) and encrypted data (rest)
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt using AES-GCM
    const decrypted = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    );

    // Convert decrypted data to string and parse JSON
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decrypted);
    const markups = JSON.parse(plaintext);

    if (!Array.isArray(markups)) {
      log.error('[MarkupEncryption] Decrypted data is not an array');
      return null;
    }

    return markups;
  } catch (error) {
    // Decryption failed - could be old unencrypted data or corrupted data
    // Try to parse as plain JSON for backward compatibility
    log.warn('[MarkupEncryption] Decryption failed, attempting plain JSON parse', error);
    try {
      const parsed = JSON.parse(encryptedData);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (parseError) {
      // Not valid JSON either
      log.error('[MarkupEncryption] Failed to parse as JSON', parseError);
    }
    return null;
  }
}

/**
 * Check if encryption is available
 * @returns {boolean} True if Web Crypto API is available
 */
export function isEncryptionAvailable() {
  return !!globalThis.crypto?.subtle;
}
