import { IBM_Plex_Sans, Spectral } from "next/font/google";

const heading = Spectral({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-2-heading",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-2-body",
});

export default function RouteTwoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${heading.variable} ${body.variable} font-[var(--font-2-body)] min-h-screen`}
    >
      {children}
    </div>
  );
}
