"use client";

import { useEffect, useRef, useState } from "react";

const DELAY_MS = 400;
const OFFSET = 12;

export function GlobalTooltip() {
  const [state, setState] = useState({ text: "", x: 0, y: 0, visible: false });
  const timeoutRef = useRef(null);
  const savedTitleRef = useRef(null);
  const targetRef = useRef(null);

  useEffect(() => {
    const show = (text, x, y) => setState({ text, x, y, visible: true });
    const hide = () => setState((s) => ({ ...s, visible: false }));

    const restoreTitle = () => {
      if (targetRef.current && savedTitleRef.current !== null) {
        targetRef.current.setAttribute("title", savedTitleRef.current);
        targetRef.current = null;
        savedTitleRef.current = null;
      }
    };

    const handleMouseOver = (e) => {
      const el = e.target.closest?.("[title]");
      const title = el?.getAttribute?.("title")?.trim();
      if (!title) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        restoreTitle();
        hide();
        return;
      }
      if (targetRef.current !== el) restoreTitle();
      targetRef.current = el;
      savedTitleRef.current = title;
      el.setAttribute("title", "");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        const rect = el.getBoundingClientRect();
        show(title, rect.left + rect.width / 2, rect.top);
      }, DELAY_MS);
    };

    const handleMouseOut = (e) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (!targetRef.current) return;
      if (e.relatedTarget && targetRef.current.contains(e.relatedTarget)) return;
      restoreTitle();
      hide();
    };

    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("mouseout", handleMouseOut, true);
    return () => {
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("mouseout", handleMouseOut, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      restoreTitle();
    };
  }, []);

  if (!state.visible || !state.text) return null;

  return (
    <div
      className="fluxa-global-tooltip"
      style={{
        left: state.x,
        top: state.y - OFFSET,
        transform: "translate(-50%, -100%)",
      }}
      role="tooltip"
      aria-hidden
    >
      {state.text}
    </div>
  );
}
