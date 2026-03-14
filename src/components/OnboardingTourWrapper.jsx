"use client";

import { useAuthUser } from "@/components/AuthUserProvider";
import OnboardingTour from "@/components/OnboardingTour";

export default function OnboardingTourWrapper() {
  const { user, loading, onboardingCompleted, completeOnboarding, forceShowTourOnce } = useAuthUser();
  const active = !loading && !!user && (!onboardingCompleted || forceShowTourOnce);
  return (
    <OnboardingTour
      key={forceShowTourOnce ? "re-run" : "auto"}
      active={active}
      onComplete={completeOnboarding}
    />
  );
}
