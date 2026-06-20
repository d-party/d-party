import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

import "./globals.css";

export const metadata: Metadata = {
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
  openGraph: {
    title: "d-party",
    siteName: "d-party",
    type: "website",
    locale: "ja_JP",
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
