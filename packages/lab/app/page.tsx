import Link from "next/link";
import { Cormorant_Garamond, Source_Code_Pro } from "next/font/google";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "700"],
});
const mono = Source_Code_Pro({ subsets: ["latin"], weight: ["400", "600"] });

const routes = [
  { id: 1, label: "Route /1 - Industrial Sidebar + Tabs" },
  { id: 2, label: "Route /2 - Editorial Ledger" },
  { id: 3, label: "Route /3 - Command Grid" },
  { id: 4, label: "Route /4 - Dossier Reading Room" },
  { id: 5, label: "Route /5 - Control Board" },
];

export default function HomePage() {
  return (
    <div
      className={`${mono.className} min-h-screen`}
      style={{ backgroundColor: "#0d1016", color: "#e7e2d9" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.4em] text-[#9aa3b2]">
          judge-gym
        </p>
        <h1
          className={`${display.className} mt-4 text-4xl md:text-5xl`}
          style={{ color: "#f6b26b" }}
        >
          Mission Control Layout Studies
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[#b8c0cc]">
          Five structurally distinct, multi-page Mission Control implementations.
          Each route preserves the same workflow and data, but presents it through
          a different spatial composition.
        </p>

        <div className="mt-10 grid gap-3">
          {routes.map((route) => (
            <Link
              key={route.id}
              href={`/${route.id}/experiments`}
              className="group flex items-center justify-between rounded border px-4 py-4 text-sm transition"
              style={{ borderColor: "#1f2533", backgroundColor: "#111622" }}
            >
              <span>{route.label}</span>
              <span className="text-xs uppercase tracking-widest text-[#6f7c91] group-hover:text-[#f6b26b]">
                Enter
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
