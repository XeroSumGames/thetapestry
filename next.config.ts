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
  async rewrites() {
    return [
      // apegenerator lives in its own repo (github.com/XeroSumGames/apegenerator)
      // per AGENTS.md; proxy /apegenerator to its Vercel deployment so the public
      // URL is unchanged and the page runs on THIS origin - its visit beacon then
      // posts page='/apegenerator' to log-visit, which the /ape-log dashboard reads.
      // Use the stable production alias (never the per-build hashed URL, which is
      // behind Vercel's auth wall and changes every deploy).
      { source: '/apegenerator', destination: 'https://apegenerator.vercel.app' },
      { source: '/apegenerator/:path*', destination: 'https://apegenerator.vercel.app/:path*' },
      // space1999generator: same pattern - its own repo
      // (github.com/XeroSumGames/space1999generator), proxied so /space1999 runs
      // on THIS origin and its beacon posts page='/space1999' to log-visit for
      // the /ape-log dashboard. Stable production alias, not the hashed URL.
      { source: '/space1999', destination: 'https://space1999generator.vercel.app' },
      { source: '/space1999/:path*', destination: 'https://space1999generator.vercel.app/:path*' },
      // dredd-generator: same pattern - its own repo
      // (github.com/XeroSumGames/dredd-generator), proxied so /dredd-generator
      // runs on THIS origin and its beacon posts page='/dredd-generator' to
      // log-visit for the /dredd-generator-log dashboard. Stable production
      // alias, not the hashed URL.
      { source: '/dredd-generator', destination: 'https://dredd-generator.vercel.app' },
      { source: '/dredd-generator/:path*', destination: 'https://dredd-generator.vercel.app/:path*' },
    ]
  },
};

// Wrap with Sentry. When SENTRY_AUTH_TOKEN isn't set (local dev or
// pre-account-creation), source-map upload is silently skipped - the
// runtime SDK still captures errors, just with minified stack traces.
// SENTRY_ORG and SENTRY_PROJECT are pulled from env vars at build time.
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "xero-sum-games",

  project: "thetapestry",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
