/** @type {import('next').NextConfig} */
const nextConfig = {
  // old links (bookmarks, home-screen shortcuts) keep working: permanent redirects from the old page names to the new ones
  async redirects() {
    return [
      { source: "/clasament", destination: "/punctaj", permanent: true },
      { source: "/istoric", destination: "/rezultate", permanent: true },
      { source: "/tabele", destination: "/clasamente", permanent: true },
    ];
  },
};
export default nextConfig;
