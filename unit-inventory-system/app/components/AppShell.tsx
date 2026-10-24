"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory Register" },
  { href: "/manage", label: "Add / Edit / Remove" },
];

// Own component so the once-a-second tick re-renders only the clock.
function Clock() {
  const [dateTime, setDateTime] = useState("");

  useEffect(() => {
    const format = () =>
      new Date().toLocaleString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

    const timer = setInterval(() => setDateTime(format()), 1000);
    const first = setTimeout(() => setDateTime(format()), 0);

    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, []);

  return (
    <div className="top-clock">
      <span>Date & Time</span>
      <b suppressHydrationWarning>{dateTime}</b>
    </div>
  );
}

// The theme lives on <html data-theme>; the inline script in layout.tsx sets
// it before paint, and this reads it back.
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

  function isActive(path: string) {
    return path === "/" ? pathname === "/" : pathname.startsWith(path);
  }

  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = theme === "light" ? "dark" : "light";

    root.classList.add("theme-changing");
    root.setAttribute("data-theme", nextTheme);

    try {
      localStorage.setItem("inventory_theme", nextTheme);
    } catch {
      // storage unavailable; theme still changes for this visit
    }

    setTimeout(() => root.classList.remove("theme-changing"), 350);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (pathname === "/login") {
    return <main className="login-only">{children}</main>;
  }

  const themeLabel = theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode";

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand-logo-wrap" aria-label="Dashboard">
          <Image
            src="/logo.png"
            alt="5 Signal Battalion Inventory Logo"
            width={58}
            height={58}
            priority
            className="brand-logo-img"
          />
        </Link>

        <div className="brand-title">
          <h1>5 Signal Battalion — Unit Inventory</h1>
          <p>Unit Property Management System</p>
        </div>

        <div className="top-right-area">
          <Clock />

          <nav className="top-actions page-links">
            {NAV.map((link) => (
              <Link
                key={link.href}
                className={isActive(link.href) ? "active" : ""}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}

            <button className="theme-icon-btn" onClick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
              <span suppressHydrationWarning>{theme === "light" ? "🌙" : "☀️"}</span>
            </button>

            <button className="logout-btn" onClick={logout}>
              Logout
            </button>
          </nav>
        </div>
      </header>

      <section className="layout no-sidebar-layout">
        <section className="content-area full-content-area">
          <section key={pathname} className="content page-transition">
            {children}
          </section>

          <footer className="app-footer">
            <span suppressHydrationWarning>© {new Date().getFullYear()} 5 Signal Battalion</span>
            <span>Courtesy: BA 11108 Capt Asif Mahmud, Sigs</span>
          </footer>
        </section>
      </section>
    </main>
  );
}
