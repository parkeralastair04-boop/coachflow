import { NextResponse } from "next/server";
import {
  getSetupRequiredMessage,
  isMissingTableError,
} from "@/lib/supabase-errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type FeatureRequestBody = {
  featureName?: string;
  description?: string;
  benefit?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeatureRequestBody;
    const featureName = body.featureName?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const benefit = body.benefit?.trim() ?? "";

    if (!featureName) {
      return NextResponse.json({ error: "Feature name is required." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    if (!benefit) {
      return NextResponse.json({ error: "Benefit is required." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to request a feature." },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from("support_feature_requests")
      .insert({
        user_id: user.id,
        user_email: user.email ?? null,
        feature_name: featureName,
        description,
        benefit,
      })
      .select("id, created_at")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        const setup = getSetupRequiredMessage(["support_feature_requests"]);
        return NextResponse.json(
          {
            setupRequired: true,
            message: setup.description,
            tables: ["support_feature_requests"],
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id, createdAt: data?.created_at });
  } catch {
    return NextResponse.json({ error: "Unable to submit feature request." }, { status: 500 });
  }
}
