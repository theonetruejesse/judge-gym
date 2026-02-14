import { Fira_Sans, Newsreader } from "next/font/google";

const heading = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-4-heading",
});

const body = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-4-body",
});

export default function RouteFourLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${heading.variable} ${body.variable} font-[var(--font-4-body)] min-h-screen`}
    >
      {children}
    </div>
  );
}
