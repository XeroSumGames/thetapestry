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