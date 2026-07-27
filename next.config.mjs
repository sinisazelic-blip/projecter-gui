/** @type {import('next').NextConfig} */
const nextConfig = {
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
