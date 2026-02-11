"use client";

import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  icon?: string;
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 980,
  icon = "/fluxa/Ikona Siva.png",
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modalOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modalContent" style={{ width: `min(${width}px, 100%)` }}>
        <div className="modalHeader">
          <div className="modalTitle">
            {icon && (
              <img
                src={icon}
                alt="Fluxa"
                className="modalTitleIcon"
              />
            )}
            <div>
              <div className="modalTitleText" id="modal-title">
                {title}
              </div>
              {subtitle && <div className="modalSubtitle">{subtitle}</div>}
            </div>
          </div>
          <button className="btn" onClick={onClose} aria-label="Zatvori">
            ✖
          </button>
        </div>

        <div className="modalBody">{children}</div>

        {footer && <div className="modalFooter">{footer}</div>}
      </div>
    </div>
  );
}
