import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

// Typography research (see docs/ALGORITHM.md §1.3): rounded, friendly,
// highly-legible sans-serifs are the best fit for kids' products.
// - Fredoka  -> display / headings / buttons (chunky, bubbly, Duolingo-like)
// - Nunito   -> body / numbers (rounded terminals, tall x-height, easy to read)
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Think Leo — Brain Quests for Kids",
  description:
    "Roar into brain quests with Leo the lion! Levels, streaks, combos and stars — a playful thinking game for curious kids. Best on a laptop.",
  applicationName: "Think Leo",
  manifest: "/manifest.webmanifest",
  keywords: ["kids", "brain games", "puzzles", "learning", "Think Leo", "PWA"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Think Leo",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFB020",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fredoka.variable} ${nunito.variable} antialiased bg-background text-foreground overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
