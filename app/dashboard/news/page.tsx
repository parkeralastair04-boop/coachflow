import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsManager } from "@/components/news-manager";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Club News",
};

export default function NewsPage() {
  return (
    <FeatureGate feature="academy_news">
      <Suspense
        fallback={
          <div className="glass-panel text-muted rounded-2xl p-6 text-sm">
            Loading news…
          </div>
        }
      >
        <NewsManager />
      </Suspense>
    </FeatureGate>
  );
}
