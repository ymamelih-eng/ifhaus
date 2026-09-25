// Meta (Messenger + Instagram) settings. Read lazily from the environment so
// credentials never live in code and tests can supply their own values.

export function readMetaConfig(env = process.env) {
  return {
    verifyToken: env.META_VERIFY_TOKEN || '',
    appSecret: env.META_APP_SECRET || '',
    pageAccessToken: env.META_PAGE_ACCESS_TOKEN || '',
    graphApiVersion: env.META_GRAPH_API_VERSION || 'v23.0',
    // Optional: send as a specific Page instead of /me.
    pageId: env.META_PAGE_ID || '',
    // Instagram can use the Page token (Messenger API for Instagram, graph.facebook.com)
    // or its own token (Instagram API with Instagram Login, graph.instagram.com).
    instagramAccessToken: env.META_INSTAGRAM_ACCESS_TOKEN || '',
    instagramAccountId: env.META_INSTAGRAM_ACCOUNT_ID || '',
    instagramGraphHost: env.META_INSTAGRAM_GRAPH_HOST || 'graph.facebook.com'
  };
}

// Booleans only, safe to expose on /api/health.
export function metaStatus(config = readMetaConfig()) {
  return {
    verifyTokenConfigured: Boolean(config.verifyToken),
    appSecretConfigured: Boolean(config.appSecret),
    pageAccessTokenConfigured: Boolean(config.pageAccessToken),
    instagramAccessTokenConfigured: Boolean(config.instagramAccessToken || config.pageAccessToken)
  };
}
