"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "./I18nProvider";

// Own component so its updates re-render only the clock.
function Clock() {
  const { locale } = useI18n();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="clock" aria-hidden>
      <span>{now ? now.toLocaleDateString(locale, { weekday: "long" }) : " "}</span>
      <b>
        {now
          ? now.toLocaleString(locale, {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          : " "}
      </b>
    </div>
  );
}

// The theme lives on <html data-theme>; the inline script in layout.tsx sets
// it before the first paint, and this hook reads it back.
function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function useTheme() {
  return useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light" as const
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const { t, lang, setLang } = useI18n();

  // Login and print pages have no header or footer.
  if (pathname === "/login" || pathname.startsWith("/print")) {
    return <>{children}</>;
  }

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("inventory_theme", next);
    } catch {
      // storage unavailable; the theme still changes for this visit
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = [
    { href: "/", label: t("navDashboard") },
    { href: "/inventory", label: t("navRegister") },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const themeLabel = theme === "light" ? t("darkMode") : t("lightMode");

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand" aria-label={t("navDashboard")}>
          <Image src="/logo-mark.png" alt="5 Sig Bn UIMS" width={62} height={62} priority className="brand-logo" />
          <div>
            <h1>{t("appName")}</h1>
            <p>{t("appSub")}</p>
          </div>
        </Link>

        <nav className="nav" aria-label="Main">
          {nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive(link.href) ? "active" : ""}`}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-tools">
          <Clock />
          <button
            type="button"
            className="lang-btn"
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            title={t("langTitle")}
            lang={lang === "en" ? "bn" : "en"}
          >
            {t("langButton")}
          </button>
          <button type="button" className="icon-btn" onClick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
            <span suppressHydrationWarning>{theme === "light" ? "🌙" : "☀️"}</span>
          </button>
          <button type="button" className="logout-btn" onClick={logout}>
            {t("logout")}
          </button>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="footer">
        <span suppressHydrationWarning>{t("footerCopy", { year: new Date().getFullYear() })}</span>
        <span>{t("footerCourtesy")}</span>
      </footer>
    </div>
  );
}
