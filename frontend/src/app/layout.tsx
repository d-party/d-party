import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SITE_URL } from "@/infrastructure/env";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "d-party",
    template: "%s | d-party",
  },
  description:
    "dアニメストアでもウォッチパーティーができる、完全無料の Google Chrome 向け拡張機能 d-party。",
  keywords: [
    "d-party",
    "dパーティー",
    "ウォッチパーティー",
    "dアニメストア",
    "同時視聴",
  ],
  authors: [{ name: "U-Not" }],
  icons: {
    icon: [
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  // Defaults for any route that does not set its own (see lib/metadata.ts).
  // The card images come from the `opengraph-image` / `twitter-image` file
  // conventions: the site-wide card at the app root, a per-room card in the lobby.
  openGraph: {
    title: "d-party",
    description:
      "dアニメストアでもウォッチパーティーができる、完全無料の Google Chrome 向け拡張機能 d-party。",
    siteName: "d-party",
    type: "website",
    locale: "ja_JP",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "d-party",
    description:
      "dアニメストアでもウォッチパーティーができる、完全無料の Google Chrome 向け拡張機能 d-party。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="ja">
      <body className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
