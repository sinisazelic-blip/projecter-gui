import path from "node:path";
import { fileURLToPath } from "node:url";

const fluxaRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // D:\Dev ima tuđe lockfile-ove; bez ovoga Next uzme D:\Dev kao workspace root.
  outputFileTracingRoot: fluxaRoot,
  // Omogućava dev pristup sa lokalne mreže bez budućih blokada.
  // Važi samo za `next dev`.
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.70.150:3000",
  ],
  // pdf-parse / pdfjs ne smiju u webpack bundle (Object.defineProperty na non-object).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
