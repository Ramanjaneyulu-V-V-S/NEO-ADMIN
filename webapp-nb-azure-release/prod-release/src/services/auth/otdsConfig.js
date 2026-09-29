/**
 * OTDS OAuth2 configuration.
 * Single source of truth for OTDS endpoint and client settings.
 */

const _clientId = import.meta.env.VITE_OTDS_CLIENT_ID;
const _tokenUrl = import.meta.env.VITE_OTDS_TOKEN_URL;

if (!_clientId) {
  console.error("VITE_OTDS_CLIENT_ID is not set. OTDS authentication will fail.");
}

if (!_tokenUrl) {
  console.error("VITE_OTDS_TOKEN_URL is not set. OTDS authentication will fail.");
}

export const OTDS_CLIENT_ID = _clientId;

export const TOKEN_ENDPOINT = _tokenUrl;
export const REFRESH_ENDPOINT = import.meta.env.VITE_OTDS_REFRESH_URL;
