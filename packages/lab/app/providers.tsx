"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function Providers({ children }: { children: React.ReactNode }) {
  if (!convex) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="px-6 py-12">
          <p className="text-sm">Missing `NEXT_PUBLIC_CONVEX_URL`.</p>
          <p className="mt-2 text-xs opacity-60">
            Set the Convex URL to use the lab app.
          </p>
        </div>
      </div>
    );
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
