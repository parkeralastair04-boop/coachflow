import { BrandAppIcon, BrandMark } from "@/components/brand-mark";

export default function Loading() {
  return (
    <div className="mesh-gradient flex min-h-screen items-center justify-center px-6">
      <div className="glass-panel flex w-full max-w-sm flex-col items-center rounded-[2rem] px-8 py-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
        <div className="size-24 overflow-hidden rounded-[28%] shadow-[0_20px_60px_rgba(16,185,129,0.2)] sm:size-28">
          <BrandAppIcon />
        </div>
        <div className="mt-6 inline-flex items-center gap-3 leading-none">
          <BrandMark className="text-navy size-10 dark:text-white" />
          <p className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
            <span className="text-navy dark:text-white">Coach</span>
            <span className="text-accent">Flow</span>
          </p>
        </div>
        <p className="text-muted mt-3 text-sm">Loading your coaching workspace...</p>
      </div>
    </div>
  );
}
