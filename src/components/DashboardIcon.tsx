"use client";

/** Ikona za Dashboard dugme (Fluxa Icon.ico) – koristi globalno umjesto 🏠 */
export default function DashboardIcon({ size = 18, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <img
      src="/fluxa/Icon.ico"
      alt=""
      style={{
        width: size,
        height: size,
        verticalAlign: "middle",
        marginRight: 6,
        ...style,
      }}
    />
  );
}
