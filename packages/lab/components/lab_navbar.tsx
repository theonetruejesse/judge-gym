import Link from "next/link";

export default function LabNavbar() {
  return (
    <header className="flex items-center border-b border-border bg-card/80 px-6 py-4">
      <Link
        href="/"
        className="text-lg font-semibold text-[#ff6b35] transition-opacity hover:opacity-80"
        style={{ fontFamily: "var(--font-1-serif)" }}
      >
        judge-gym
      </Link>
    </header>
  );
}
