/** @type {import('next').NextConfig} */
const nextConfig = {
  // Omogućava dev pristup sa lokalne mreže bez budućih blokada.
  // Važi samo za `next dev`.
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.70.150:3000",
  ],
};

export default nextConfig;
