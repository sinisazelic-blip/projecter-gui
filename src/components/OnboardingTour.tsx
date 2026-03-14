"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ONBOARDING_STEPS,
  getStepPathMatch,
  getStepForPath,
} from "@/lib/onboarding-steps";

const OVERLAY_Z = 9998;
const POPUP_Z = 10000;

export default function OnboardingTour({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popupPlace, setPopupPlace] = useState<"bottom" | "top" | "left" | "right">("bottom");
  const targetRef = useRef<Element | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const step = useMemo(() => {
    if (stepIndex < 0 || stepIndex >= ONBOARDING_STEPS.length) return null;
    const s = ONBOARDING_STEPS[stepIndex];
    return getStepPathMatch(s, pathname) ? s : null;
  }, [stepIndex, pathname]);

  const stepForPath = getStepForPath(pathname, stepIndex);
  const showPopup = active && (step ?? stepForPath);
  const rawStep = step ?? stepForPath;
  const isDealDetail = pathname.match(/^\/inicijacije\/[^/]+$/);
  const currentStep = useMemo(() => {
    if (!rawStep) return null;
    if (rawStep.target === "deal-stavke" && !isDealDetail) {
      return {
        ...rawStep,
        body: (rawStep as { bodyOnList?: string }).bodyOnList ?? rawStep.body,
        nextLabel: (rawStep as { nextLabelOnList?: string }).nextLabelOnList ?? rawStep.nextLabel,
        target: null,
      };
    }
    return rawStep;
  }, [rawStep, isDealDetail]);
  const hasTarget = currentStep?.target;

  const updateTargetRect = useCallback(() => {
    if (typeof document === "undefined" || !currentStep?.target) {
      setTargetRect(null);
      targetRef.current = null;
      return;
    }
    const el = document.querySelector(`[data-onboarding="${currentStep.target}"]`);
    if (el !== targetRef.current) {
      targetRef.current = el;
      if (resizeObserverRef.current && targetRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (el) {
        resizeObserverRef.current = new ResizeObserver(() => {
          setTargetRect(el.getBoundingClientRect());
        });
        resizeObserverRef.current.observe(el);
      }
    }
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      const rect = el.getBoundingClientRect();
      const spaceBottom = window.innerHeight - rect.bottom;
      const spaceTop = rect.top;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;
      if (spaceBottom >= 200) setPopupPlace("bottom");
      else if (spaceTop >= 200) setPopupPlace("top");
      else if (spaceRight >= 320) setPopupPlace("right");
      else setPopupPlace("left");
    } else {
      setTargetRect(null);
    }
  }, [currentStep?.target]);

  useEffect(() => {
    updateTargetRect();
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [updateTargetRect]);

  useEffect(() => {
    if (!active || !hasTarget) return;
    const t = 100;
    const id = setInterval(updateTargetRect, t);
    return () => clearInterval(id);
  }, [active, hasTarget, updateTargetRect]);

  const handleNext = useCallback(() => {
    const steps = ONBOARDING_STEPS;
    const current = steps[stepIndex];
    if (stepIndex === 2 && current?.path === "/dashboard") {
      router.push("/inicijacije");
      setStepIndex(3);
      return;
    }
    if (stepIndex === 4 && pathname.match(/^\/inicijacije\/[^/]+$/)) {
      router.push("/dashboard");
      setStepIndex(5);
      return;
    }
    if (stepIndex === 4 && pathname === "/inicijacije") {
      router.push("/dashboard");
      setStepIndex(5);
      return;
    }
    if (stepIndex === 3 && pathname === "/inicijacije") {
      setStepIndex(4);
      return;
    }
    if (stepIndex >= steps.length - 1) {
      onComplete();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [stepIndex, pathname, router, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Escape key to skip tour (izlaz kad zaglavi)
  useEffect(() => {
    if (!active || !currentStep) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, currentStep, onComplete]);

  // Reset kad path ne odgovara koraku – nakon kratke pauze da ne prekine navigaciju
  useEffect(() => {
    if (!active || stepIndex <= 0) return;
    if (step ?? stepForPath) return;
    const t = setTimeout(() => {
      setStepIndex(0);
      router.replace("/dashboard");
    }, 800);
    return () => clearTimeout(t);
  }, [active, stepIndex, step, stepForPath, router]);

  if (!active || !currentStep) return null;

  const isFinish = stepIndex >= ONBOARDING_STEPS.length - 1;
  const showNext = true;
  const showSkip = !!currentStep.skipLabel && !isFinish;

  const popupContent = (
    <div
      role="dialog"
      aria-label={currentStep.title}
      style={{
        position: "fixed",
        zIndex: POPUP_Z,
        maxWidth: 360,
        width: "calc(100vw - 24px)",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        padding: 16,
        ...(hasTarget && targetRect
          ? popupPlace === "bottom"
            ? { left: targetRect.left + targetRect.width / 2, top: targetRect.bottom + 12, transform: "translate(-50%, 0)" }
            : popupPlace === "top"
              ? { left: targetRect.left + targetRect.width / 2, top: Math.max(12, targetRect.top - 220), transform: "translate(-50%, 0)" }
              : popupPlace === "right"
                ? { left: targetRect.right + 12, top: targetRect.top + targetRect.height / 2, transform: "translate(0, -50%)" }
                : { left: Math.max(12, targetRect.left - 340), top: targetRect.top + targetRect.height / 2, transform: "translate(0, -50%)" }
          : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }),
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>{currentStep.title}</h3>
      <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.45 }}>{currentStep.body}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {showSkip && (
          <button type="button" className="btn" onClick={handleSkip} style={{ fontSize: 13 }}>
            {currentStep.skipLabel}
          </button>
        )}
        {showNext && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleNext}
            style={{ fontSize: 13 }}
          >
            {currentStep.nextLabel}
          </button>
        )}
      </div>
    </div>
  );

  const overlay = (
    <>
      {/* Dark overlay with cutout: four panels so the target stays clickable */}
      {hasTarget && targetRect ? (
        <>
          <div style={{ position: "fixed", left: 0, top: 0, right: 0, height: targetRect.top, zIndex: OVERLAY_Z, background: "rgba(0,0,0,0.5)", pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: 0, top: targetRect.top, width: targetRect.left, height: targetRect.height, zIndex: OVERLAY_Z, background: "rgba(0,0,0,0.5)", pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: targetRect.right, top: targetRect.top, right: 0, height: targetRect.height, zIndex: OVERLAY_Z, background: "rgba(0,0,0,0.5)", pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: 0, top: targetRect.bottom, right: 0, bottom: 0, zIndex: OVERLAY_Z, background: "rgba(0,0,0,0.5)", pointerEvents: "auto" }} />
          <div
            style={{
              position: "fixed",
              left: targetRect.left - 2,
              top: targetRect.top - 2,
              width: targetRect.width + 4,
              height: targetRect.height + 4,
              zIndex: OVERLAY_Z + 1,
              pointerEvents: "none",
              borderRadius: 10,
              boxShadow: "0 0 0 4px var(--accent, #3b82f6)",
              animation: "onboarding-pulse 2s ease-in-out infinite",
            }}
          />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, zIndex: OVERLAY_Z, background: "rgba(0,0,0,0.5)", pointerEvents: "auto" }} />
      )}
      {popupContent}
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
