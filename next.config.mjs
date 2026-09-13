/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // GhostOps uses its own locale routing (`/[locale]`) and sets `dir`/`lang` from the
  // root layout, so framework i18n routing is intentionally not enabled.
};

export default nextConfig;
