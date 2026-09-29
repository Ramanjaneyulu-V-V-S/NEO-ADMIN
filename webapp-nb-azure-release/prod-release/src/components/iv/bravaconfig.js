import { getInitConfig } from "../../services/auth/initConfig";

const bravaconfig = {
  tokenUrl: import.meta.env.VITE_BRAVA_TOKEN_URL,
  publicationsUrl: import.meta.env.VITE_BRAVA_PUBLICATIONS_URL,
  publicationAuthority: import.meta.env.VITE_BRAVA_PUBLICATION_AUTHORITY,
  viewerAuthority: import.meta.env.VITE_BRAVA_VIEWER_AUTHORITY,
  highlightAuthority: import.meta.env.VITE_BRAVA_HIGHLIGHT_AUTHORITY,
  markupAuthority: import.meta.env.VITE_BRAVA_MARKUP_AUTHORITY,

  get credentials() {
    const config = getInitConfig();
    return {
      grant_type: config?.VITE_BRAVA_GRANT_TYPE || "",
      username: config?.VITE_BRAVA_USERNAME || "",
      password: config?.VITE_BRAVA_PASSWORD || "",
      client_id: config?.VITE_BRAVA_CLIENT_ID || "",
      client_secret: config?.VITE_BRAVA_CLIENT_SECRET || "",
    };
  },

  viewer: {
    name: "brava-view-1.x",
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  },

  isDevelopment: import.meta.env.MODE === "development",
};

export default bravaconfig;
