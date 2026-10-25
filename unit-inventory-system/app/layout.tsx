import type { Metadata } from "next";
import { cookies } from "next/headers";
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
import "@fontsource/noto-sans-bengali/bengali-400.css";
import "@fontsource/noto-sans-bengali/bengali-500.css";
import "@fontsource/noto-sans-bengali/bengali-600.css";
import "@fontsource/noto-sans-bengali/bengali-700.css";
import "./globals.css";
import AppShell from "./components/AppShell";
import { I18nProvider } from "./components/I18nProvider";
import { LANG_COOKIE, isLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "UIMS · 5 Signal Battalion",
  description: "Unit Inventory Management System — 5 Signal Battalion",
};

// Applies the saved theme before the page paints (no light-mode flash).
const themeScript = `try{var t=localStorage.getItem("inventory_theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(saved) ? saved : "en";

  return (
    <html lang={lang} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider initialLang={lang}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
