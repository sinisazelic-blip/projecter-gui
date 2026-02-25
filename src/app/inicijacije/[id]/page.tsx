// src/app/inicijacije/[id]/page.tsx
// Server component: uvozi klijentsku komponentu (fix za React Client Manifest u Next.js 16)
import InicijacijaDetailClient from "./InicijacijaDetailClient";

export default function InicijacijaDetailPage() {
  return <InicijacijaDetailClient />;
}
