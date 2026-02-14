import { Bitter, JetBrains_Mono } from "next/font/google";

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

export default function RouteOneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${serif.variable} ${mono.variable} font-[var(--font-1-mono)] min-h-screen`}
    >
      {children}
    </div>
  );
}
