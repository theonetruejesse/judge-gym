import { Bebas_Neue, Inconsolata } from "next/font/google";

const heading = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-5-heading",
});

const body = Inconsolata({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-5-body",
});

export default function RouteFiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${heading.variable} ${body.variable} font-[var(--font-5-body)] min-h-screen`}
    >
      {children}
    </div>
  );
}
