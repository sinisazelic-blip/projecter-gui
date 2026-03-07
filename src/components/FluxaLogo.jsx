"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function FluxaLogo({ className = "brandLogo", alt = "FLUXA", style, ...props }) {
  const { theme } = useTheme();
  const src = theme === "light" ? "/fluxa/logo-dark.png" : "/fluxa/logo-light.png";
  return <img src={src} alt={alt} className={className || undefined} style={style} {...props} />;
}
