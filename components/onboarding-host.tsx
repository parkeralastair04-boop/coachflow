"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildOnboardingProgress,
  isOnboardingComplete,
  parseOnboardingMetadata,
  shouldAutoShowOnboarding,
  type OnboardingStepId,
} from "@/lib/onboarding";
import { fetchOnboardingCounts } from "@/lib/onboarding-setup";
import { resumeOnboarding } from "@/lib/onboarding-metadata";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { createClient } from "@/lib/supabase";

export function OnboardingHost() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initialStep, setInitialStep] = useState<OnboardingStepId>(1);
  const [ready, setReady] = useState(false);

  const evaluateAutoShow = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const metadata = parseOnboardingMetadata(user.user_metadata);
      if (!shouldAutoShowOnboarding(user.user_metadata)) return;

      const counts = await fetchOnboardingCounts(supabase, user.id);
      // Auto-open until the coach has a real parent booking (or pauses/completes the wizard).
      // A published session alone must not skip the share-link step.
      if (counts.hasBooking) return;

      setInitialStep(metadata.currentStep);
      setWizardOpen(true);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void evaluateAutoShow();
  }, [evaluateAutoShow]);

  useEffect(() => {
    function handleResume(event: Event) {
      const detail = (event as CustomEvent<{ step?: OnboardingStepId }>).detail;
      void (async () => {
        try {
          const supabase = createClient();
          await resumeOnboarding(supabase);
        } catch {
          // Open wizard even if metadata update fails.
        }
        setInitialStep(detail?.step ?? 1);
        setWizardOpen(true);
      })();
    }

    window.addEventListener("awarix:resume-onboarding", handleResume);
    return () => window.removeEventListener("awarix:resume-onboarding", handleResume);
  }, []);

  if (!ready) return null;

  return (
    <OnboardingWizard
      open={wizardOpen}
      initialStep={initialStep}
      onClose={() => setWizardOpen(false)}
      onComplete={() => {
        setWizardOpen(false);
        window.dispatchEvent(new CustomEvent("awarix:onboarding-updated"));
      }}
      onProgressChange={() => {
        window.dispatchEvent(new CustomEvent("awarix:onboarding-updated"));
      }}
    />
  );
}

export function dispatchResumeOnboarding(step: OnboardingStepId = 1) {
  window.dispatchEvent(
    new CustomEvent("awarix:resume-onboarding", { detail: { step } }),
  );
}

export function useOnboardingState() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStepId>(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const metadata = parseOnboardingMetadata(user.user_metadata);
      setCompleted(isOnboardingComplete(user.user_metadata));
      setPaused(Boolean(metadata.pausedAt));
      setCurrentStep(metadata.currentStep);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const metadata = parseOnboardingMetadata(user.user_metadata);
        if (cancelled) return;
        setCompleted(isOnboardingComplete(user.user_metadata));
        setPaused(Boolean(metadata.pausedAt));
        setCurrentStep(metadata.currentStep);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    function handleUpdate() {
      void refresh();
    }
    window.addEventListener("awarix:onboarding-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("awarix:onboarding-updated", handleUpdate);
    };
  }, [refresh]);

  return { loading, completed, paused, currentStep, refresh };
}

export async function loadOnboardingProgressSnapshot() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      progress: buildOnboardingProgress({
        hasAcademy: false,
        hasSession: false,
        hasBookingPage: false,
        bookingLinkShared: false,
      }),
      metadata: parseOnboardingMetadata(null),
    };
  }

  const metadata = parseOnboardingMetadata(user.user_metadata);
  const counts = await fetchOnboardingCounts(supabase, user.id);
  return {
    progress: buildOnboardingProgress({
      hasAcademy: counts.hasAcademy,
      hasSession: counts.hasSession,
      hasBookingPage: counts.hasBookingPage,
      bookingLinkShared: metadata.bookingLinkShared,
    }),
    metadata,
  };
}
