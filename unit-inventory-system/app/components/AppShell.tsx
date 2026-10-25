"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory Register" },
];

// Own component so its updates re-render only the clock.
function Clock() {
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
      <span>{now ? now.toLocaleDateString("en-GB", { weekday: "long" }) : " "}</span>
      <b>
        {now
          ? now.toLocaleString("en-GB", {
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

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const themeLabel = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Dashboard">
          <Image src="/logo-mark.png" alt="5 Sig Bn UIMS" width={62} height={62} priority className="brand-logo" />
          <div>
            <h1>5 Signal Battalion</h1>
            <p>Unit Inventory</p>
          </div>
        </Link>

        <nav className="nav" aria-label="Main">
          {NAV.map((link) => (
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
          <button type="button" className="icon-btn" onClick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
            <span suppressHydrationWarning>{theme === "light" ? "🌙" : "☀️"}</span>
          </button>
          <button type="button" className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="footer">
        <span suppressHydrationWarning>© {new Date().getFullYear()} 5 Signal Battalion · Unit Property Management System</span>
        <span>Courtesy: BA 11108 Capt Asif Mahmud, Sigs</span>
      </footer>
    </div>
  );
}
