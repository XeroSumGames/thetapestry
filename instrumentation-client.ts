// Sentry client init. PII is deliberately NOT sent by default; user id is
// attached explicitly via lib/auth-cache.ts after auth resolves. URL query
// params that can carry auth secrets (code, token, access_token, refresh_token)
// are scrubbed in beforeSend.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://15db6e222c63c57dbbf88464fb067958@o4511332957683712.ingest.us.sentry.io/4511332964237312",

  sendDefaultPii: false,
  tracesSampleRate: 0.1,

  beforeSend(event) {
    return scrubAuthSecrets(event);
  },
});

function scrubAuthSecrets(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const scrub = (url?: string) =>
    url?.replace(/([?&])(code|token|access_token|refresh_token)=[^&]*/gi, "$1$2=[Filtered]");
  if (event.request?.url) event.request.url = scrub(event.request.url);
  if (event.request?.headers && typeof event.request.headers === "object") {
    const headers = event.request.headers as Record<string, string>;
    if ("authorization" in headers) headers.authorization = "[Filtered]";
    if ("cookie" in headers) headers.cookie = "[Filtered]";
  }
  return event;
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
