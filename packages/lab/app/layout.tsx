import type { Metadata } from "next";
import { Bitter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import Providers from "./providers";

const serif = Bitter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-1-serif",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-1-mono",
});

export const metadata: Metadata = {
  title: "Mission Control | judge-gym",
  description: "Mission Control dashboard for judge-gym experiments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${serif.variable} ${mono.variable} min-h-screen antialiased font-[var(--font-1-mono)]`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
