import type { Metadata } from "next";
import "./globals.css";
import LayoutShell from "../components/LayoutShell";
import VisitLogger from "../components/VisitLogger";

// Site-wide defaults. Per-route layouts can override `title`, `description`,
// `openGraph`, or `twitter`; everything else falls through here. The
// `metadataBase` lets us write image paths like '/DistemperLogoRedv5.png'
// and have Next resolve them to absolute URLs that scrapers (Discord,
// Reddit, Facebook, X) can fetch.
const SITE_TITLE = 'The Tapestry — Distemper'
const SITE_DESCRIPTION = 'The DistemperVerse community platform — campaigns, characters, communities, and shared world-state across every story.'
const SITE_URL = 'https://thetapestry.distemperverse.com'
const SITE_OG_IMAGE = '/DistemperLogoRedv5.png'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s — The Tapestry',
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'The Tapestry',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: SITE_OG_IMAGE, alt: 'The Tapestry — Distemper' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <head>
        {/* Console-spam filter. A browser extension on the GM's machine
            is logging window-rect objects of the exact shape
            {x, y, w, h} hundreds of times, drowning out our diagnostic
            logs. This wraps console.log to drop messages whose ONLY
            argument is an object with EXACTLY those four keys — too
            specific to ever swallow a legitimate app log. Inline in
            <head> so it runs before any other script. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              // 1. Drop browser-extension log spam of the exact shape
              //    {x, y, w, h} — too specific to ever swallow an app log.
              var origLog = console.log;
              console.log = function() {
                if (arguments.length === 1) {
                  var a = arguments[0];
                  if (a && typeof a === 'object' && !Array.isArray(a)) {
                    var keys = Object.keys(a);
                    if (keys.length === 4 &&
                        keys.indexOf('x') !== -1 &&
                        keys.indexOf('y') !== -1 &&
                        keys.indexOf('w') !== -1 &&
                        keys.indexOf('h') !== -1) {
                      return;
                    }
                  }
                }
                // Drop bare-two-number window-dimension spam
                // (e.g. console.log(window.outerWidth, window.outerHeight))
                // from a browser extension. Heuristic: exactly two args,
                // both integers between 100 and 10000. Real app logs of
                // numeric pairs always include a label string as the first
                // arg, so this is safe.
                if (arguments.length === 2) {
                  var a0 = arguments[0], a1 = arguments[1];
                  if (typeof a0 === 'number' && typeof a1 === 'number' &&
                      Number.isInteger(a0) && Number.isInteger(a1) &&
                      a0 >= 100 && a0 <= 10000 &&
                      a1 >= 100 && a1 <= 10000) {
                    return;
                  }
                }
                return origLog.apply(console, arguments);
              };
              // 2. Drop the Supabase Realtime deprecation warning that
              //    fires whenever channel.send() is called before the
              //    subscription completes — purely informational; we'll
              //    refactor the .send() callsites later, no need to drown
              //    the console with it in the meantime.
              var origWarn = console.warn;
              console.warn = function() {
                if (arguments.length >= 1 && typeof arguments[0] === 'string' &&
                    arguments[0].indexOf('Realtime send() is automatically falling back to REST API') !== -1) {
                  return;
                }
                return origWarn.apply(console, arguments);
              };
            } catch (e) { /* noop */ }
          })();
        ` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
        <link rel="preload" href="/fonts/Distemper.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f0f0f', margin: 0, padding: 0, fontFamily: 'Barlow, sans-serif', fontSize: '15px' }}>
        <VisitLogger />
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}