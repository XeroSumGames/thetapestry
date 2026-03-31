import type { Metadata } from "next";
import "./globals.css";
import NavBar from "../components/NavBar";
import LayoutShell from "../components/LayoutShell";

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
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
      </head>
      <body style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: '#0f0f0f', margin: 0, padding: 0, fontFamily: 'Barlow, sans-serif', fontSize: '15px' }}>
        <NavBar />
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}