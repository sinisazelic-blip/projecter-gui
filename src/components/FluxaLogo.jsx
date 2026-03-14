"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function FluxaLogo({ className = "brandLogo", alt = "FLUXA", style, linkToDashboard = true, ...props }) {
  const { theme } = useTheme();
  const src = theme === "light" ? "/fluxa/logo-dark.png" : "/fluxa/logo-light.png";
  const img = <img src={src} alt={alt} className={className || undefined} style={style} {...props} />;
  if (linkToDashboard) {
    return (
      <a href="/dashboard" className="brandLogoLink" title="Dashboard">
        {img}
      </a>
    );
  }
  return img;
}
