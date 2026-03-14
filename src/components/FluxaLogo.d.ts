import type { CSSProperties } from "react";

declare function FluxaLogo(props: {
  className?: string;
  alt?: string;
  style?: CSSProperties;
  linkToDashboard?: boolean;
  [key: string]: unknown;
}): JSX.Element;

export default FluxaLogo;
