import type { Metadata, Viewport } from "next";
import { Literata, Nothing_You_Could_Do } from "next/font/google";
import "./globals.css";

// A book face for reading the letters, and a real-looking hand for everything written "by hand".
const serif = Literata({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const hand = Nothing_You_Could_Do({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
});

export const metadata: Metadata = {
  title: "Our Little Garden",
  description: "I couldn't send you flowers... so I grew you a garden.",
  // A private gift — keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e1630",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${hand.variable} font-serif`}>{children}</body>
    </html>
  );
}
