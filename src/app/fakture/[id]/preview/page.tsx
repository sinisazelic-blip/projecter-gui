// src/app/fakture/[id]/preview/page.tsx
// Server Component: samo uvozi klijentsku komponentu (fix za React Client Manifest u Next.js 16)
import FakturaPreviewClient from "./FakturaPreviewClient";

export default function FakturaPreviewPage() {
  return <FakturaPreviewClient />;
}
