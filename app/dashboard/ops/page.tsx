import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsDiagnosticsPanel } from "@/components/ops-diagnostics-panel";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { isFounder } from "@/lib/founders";
import { buildDiagnosticsPayload } from "@/lib/ops-diagnostics";
import { privateRouteMetadata } from "@/lib/private-route-metadata";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Operations diagnostics",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsDiagnosticsPage() {
  const user = await getAuthenticatedUser();
  if (!user?.email) {
    redirect("/login?next=/dashboard/ops");
  }
  if (!isFounder(user.email)) {
    redirect("/dashboard");
  }

  const diagnostics = await buildDiagnosticsPayload();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <p className="text-muted text-sm font-medium">Internal</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Operations diagnostics
        </h1>
        <p className="text-muted mt-2 max-w-2xl text-sm leading-relaxed">
          Founder-only overview of application health, webhook outcomes, and
          activation foundations. Secret values are never shown.
        </p>
      </header>
      <OpsDiagnosticsPanel initial={diagnostics} />
    </div>
  );
}
