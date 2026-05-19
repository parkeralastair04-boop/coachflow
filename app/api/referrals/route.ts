import { NextResponse } from "next/server";
import { getReferralCode, getReferralUrl } from "@/lib/referrals";
import {
  getSetupRequiredMessage,
  isMissingTableError,
} from "@/lib/supabase-errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ReferralRow = {
  id: string;
  status: "invited" | "signed_up" | "converted";
  reward_type: string | null;
  reward_value: number;
  created_at: string;
};

export async function GET() {
  try {
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
        { error: "You must be signed in to view referrals." },
        { status: 401 },
      );
    }

    const referralCode = getReferralCode(user.id);
    const { data, error } = await supabase
      .from("referrals")
      .select("id, status, reward_type, reward_value, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        const setup = getSetupRequiredMessage(["referrals"]);
        return NextResponse.json(
          {
            setupRequired: true,
            setupTables: ["referrals"],
            error: setup.description,
            referralCode,
            referralUrl: getReferralUrl(referralCode),
          },
          { status: 200 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as ReferralRow[];
    return NextResponse.json({
      referralCode,
      referralUrl: getReferralUrl(referralCode),
      metrics: {
        invitationsSent: rows.filter((row) => row.status === "invited").length,
        signupsReferred: rows.filter(
          (row) => row.status === "signed_up" || row.status === "converted",
        ).length,
        paidConversions: rows.filter((row) => row.status === "converted").length,
        rewardsEarned: rows.reduce((sum, row) => sum + row.reward_value, 0),
      },
      referrals: rows,
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load referrals.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
