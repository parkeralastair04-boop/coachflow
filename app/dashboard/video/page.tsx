import type { Metadata } from "next";
import { Suspense } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { VideoAnalysisManager } from "@/components/video-analysis-manager";

export const metadata: Metadata = {
  title: "Video Analysis",
};

export default function VideoPage() {
  return (
    <FeatureGate feature="video_analysis">
      <Suspense fallback={null}>
        <VideoAnalysisManager />
      </Suspense>
    </FeatureGate>
  );
}
