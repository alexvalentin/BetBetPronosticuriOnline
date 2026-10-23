/** @type {import('next').NextConfig} */
const nextConfig = {
  // linkurile vechi (favorite, ecran principal) continua sa mearga
  async redirects() {
    return [
      { source: "/istoric", destination: "/rezultate", permanent: true },
      { source: "/tabele", destination: "/clasamente", permanent: true },
    ];
  },
};
export default nextConfig;
