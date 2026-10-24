"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [dateTime, setDateTime] = useState("");

  function active(path: string) {
    if (path === "/" && pathname === "/") return "active";
    if (path !== "/" && pathname.startsWith(path)) return "active";
    return "";
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem("inventory_theme") as
      | "light"
      | "dark"
      | null;

    const initialTheme = savedTheme || "light";

    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  useEffect(() => {
    function updateClock() {
      const now = new Date();

      const formatted = now.toLocaleString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      setDateTime(formatted);
    }

    updateClock();

    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, []);

  function toggleTheme() {
    document.documentElement.classList.add("theme-changing");

    const nextTheme = theme === "light" ? "dark" : "light";

    setTheme(nextTheme);
    localStorage.setItem("inventory_theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);

    setTimeout(() => {
      document.documentElement.classList.remove("theme-changing");
    }, 350);
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.replace("/login");
    router.refresh();
  }

  if (pathname === "/login") {
    return <main className="login-only">{children}</main>;
  }

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
          <div className="top-clock">
            <span>Date & Time</span>
            <b>{dateTime}</b>
          </div>

          <div className="top-actions page-links">
            <Link className={active("/")} href="/">
              Dashboard
            </Link>

            <Link className={active("/inventory")} href="/inventory">
              Inventory Register
            </Link>

            <Link className={active("/manage")} href="/manage">
              Add / Edit / Remove
            </Link>

            <button
              className="theme-icon-btn"
              onClick={toggleTheme}
              title={
                theme === "light"
                  ? "Switch to Dark Mode"
                  : "Switch to Light Mode"
              }
              aria-label={
                theme === "light"
                  ? "Switch to Dark Mode"
                  : "Switch to Light Mode"
              }
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>

            <button className="logout-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="layout no-sidebar-layout">
        <section className="content-area full-content-area">
          <section key={pathname} className="content page-transition">
            {children}
          </section>

          <footer className="app-footer">
            <span>© {new Date().getFullYear()} 5 Signal Battalion</span>
            <span>Courtesy: BA 11108 Capt Asif Mahmud, Sigs</span>
          </footer>
        </section>
      </section>
    </main>
  );
}