import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

// Wrap with Sentry. When SENTRY_AUTH_TOKEN isn't set (local dev or
// pre-account-creation), source-map upload is silently skipped — the
// runtime SDK still captures errors, just with minified stack traces.
// SENTRY_ORG and SENTRY_PROJECT are pulled from env vars at build time.
export default withSentryConfig(nextConfig, {
  // Sentry's CLI options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Hide source maps from the public bundle so the prod JS doesn't
  // leak our source. Sentry uploads them privately.
  sourcemaps: { disable: false },
  // Don't break the build if Sentry CLI isn't configured (local dev,
  // first deploy before the auth token is set, etc).
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Disable Sentry-injected tunnel route by default; flip on if
  // ad-blockers start eating events in production.
  tunnelRoute: undefined,
})
