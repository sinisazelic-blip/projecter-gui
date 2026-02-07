"use client";

export default function ConfirmSubmitButton({
  children,
  message = "Da li si siguran?",
  disabled = false,
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={(e) => {
        if (disabled) return;
        const ok = window.confirm(message);
        if (!ok) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
