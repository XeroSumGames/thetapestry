import type { Metadata } from "next";
import "./globals.css";
import LayoutShell from "../components/LayoutShell";
import VisitLogger from "../components/VisitLogger";

export const metadata: Metadata = {
  title: "The Tapestry — Distemper",
  description: "The Tapestry — DistemperVerse community platform",
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