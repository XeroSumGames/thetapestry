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
      // dredd-generator stays proxied here too (it is also served on thetable).
      // Its own repo (github.com/XeroSumGames/dredd-generator); the page runs on
      // THIS origin so its beacon posts page='/dredd-generator' to log-visit for
      // the /dredd-generator-log dashboard. Stable production alias, not the hash.
      { source: '/dredd-generator', destination: 'https://dredd-generator.vercel.app' },
      { source: '/dredd-generator/:path*', destination: 'https://dredd-generator.vercel.app/:path*' },
      // walkingdead-rpg (The Walking Dead Universe RPG, Year Zero Engine). Own repo
      // (github.com/XeroSumGames/walkingdead-rpg); runs on THIS origin so its beacon
      // posts page='/walkingdead-rpg' to log-visit for the /walkingdead-rpg-log
      // dashboard. Stable production alias, not the hash.
      { source: '/walkingdead-rpg', destination: 'https://walkingdead-rpg.vercel.app' },
      { source: '/walkingdead-rpg/:path*', destination: 'https://walkingdead-rpg.vercel.app/:path*' },
    ]
  },
  async redirects() {
    return [
      // apegenerator and space1999 moved to their permanent home on
      // thetable.xerosumgames.com (the always-free Xero Sum Games property).
      // Redirect old links so they keep working. Analytics are unaffected: each
      // generator's beacon still posts page='/apegenerator' | '/space1999' to
      // log-visit (CORS is '*'), which the /ape-log and /space1999-log dashboards
      // read regardless of origin. Temporary (307) for now; promote to permanent
      // once it has settled.
      { source: '/apegenerator', destination: 'https://thetable.xerosumgames.com/apegenerator', permanent: false },
      { source: '/apegenerator/:path*', destination: 'https://thetable.xerosumgames.com/apegenerator/:path*', permanent: false },
      { source: '/space1999', destination: 'https://thetable.xerosumgames.com/space1999', permanent: false },
      { source: '/space1999/:path*', destination: 'https://thetable.xerosumgames.com/space1999/:path*', permanent: false },
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
