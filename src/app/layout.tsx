import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// Fonts: one for headings/numbers (display), one for body text; exposed as CSS variables.
const display = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
  variable: "--font-display",
});
const body = Source_Sans_3({ subsets: ["latin", "latin-ext"], variable: "--font-body" });

// Page title, description, install-as-app (PWA) manifest and iPhone home-screen icon.
export const metadata: Metadata = {
  title: "Cinci-Zero",
  description: "Pronosticuri de fotbal între prieteni",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cinci-Zero", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Mobile browser settings: bar color, light/dark support, responsive scaling.
export const viewport: Viewport = {
  themeColor: "#0F3D28",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

// Root HTML skeleton wrapping every page.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        {/* sets the theme before the first paint, so there is no white flash */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
