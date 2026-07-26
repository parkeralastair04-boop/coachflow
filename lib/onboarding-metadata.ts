import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ONBOARDING_METADATA_KEYS,
  type OnboardingStepId,
} from "@/lib/onboarding";

export async function updateOnboardingMetadata(
  supabase: SupabaseClient,
  patch: Partial<{
    currentStep: OnboardingStepId;
    pausedAt: string | null;
    completedAt: string | null;
    bookingLinkShared: boolean;
  }>,
): Promise<void> {
  const data: Record<string, unknown> = {};

  if (patch.currentStep !== undefined) {
    data[ONBOARDING_METADATA_KEYS.currentStep] = patch.currentStep;
  }
  if (patch.pausedAt !== undefined) {
    if (patch.pausedAt) {
      data[ONBOARDING_METADATA_KEYS.pausedAt] = patch.pausedAt;
    } else {
      data[ONBOARDING_METADATA_KEYS.pausedAt] = null;
    }
  }
  if (patch.completedAt !== undefined) {
    if (patch.completedAt) {
      data[ONBOARDING_METADATA_KEYS.completedAt] = patch.completedAt;
    } else {
      data[ONBOARDING_METADATA_KEYS.completedAt] = null;
    }
  }
  if (patch.bookingLinkShared !== undefined) {
    data[ONBOARDING_METADATA_KEYS.bookingLinkShared] = patch.bookingLinkShared;
  }

  const { error } = await supabase.auth.updateUser({ data });
  if (error) {
    throw new Error(error.message);
  }
}

export async function pauseOnboarding(supabase: SupabaseClient): Promise<void> {
  await updateOnboardingMetadata(supabase, {
    pausedAt: new Date().toISOString(),
  });
}

export async function resumeOnboarding(supabase: SupabaseClient): Promise<void> {
  await updateOnboardingMetadata(supabase, {
    pausedAt: null,
  });
}

export async function completeOnboarding(supabase: SupabaseClient): Promise<void> {
  await updateOnboardingMetadata(supabase, {
    completedAt: new Date().toISOString(),
    pausedAt: null,
    currentStep: 4,
  });
}

export async function markBookingLinkShared(supabase: SupabaseClient): Promise<void> {
  await updateOnboardingMetadata(supabase, {
    bookingLinkShared: true,
  });
}

export async function setOnboardingStep(
  supabase: SupabaseClient,
  step: OnboardingStepId,
): Promise<void> {
  await updateOnboardingMetadata(supabase, { currentStep: step });
}
