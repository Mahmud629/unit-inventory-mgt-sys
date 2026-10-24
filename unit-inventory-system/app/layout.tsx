import type { Metadata } from "next";
// Fonts are bundled from npm and served by the app itself, so neither the
// build nor the pages need internet access on the unit LAN.
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow/latin-800.css";
import "@fontsource/barlow/latin-900.css";
import "@fontsource/rajdhani/latin-500.css";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/rajdhani/latin-700.css";
import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "5 Signal Battalion Inventory",
  description: "Unit Property Management System",
};

// Applies the saved theme before the page paints (no light-mode flash).
const themeScript = `try{var t=localStorage.getItem("inventory_theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
