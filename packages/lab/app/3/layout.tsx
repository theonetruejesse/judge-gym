import { Chakra_Petch, Space_Mono } from "next/font/google";

const heading = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-3-heading",
});

const body = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-3-body",
});

export default function RouteThreeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${heading.variable} ${body.variable} font-[var(--font-3-body)] min-h-screen`}
    >
      {children}
    </div>
  );
}
