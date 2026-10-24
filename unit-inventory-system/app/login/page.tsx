"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Only allow redirects back into this app.
function safeNext() {
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.message || "Login failed.");
        setLoading(false);
        return;
      }

      router.replace(safeNext());
      router.refresh();
    } catch {
      setMessage("Unable to login. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo-wrap">
          <Image
            src="/logo.png"
            alt="5 Signal Battalion Logo"
            width={96}
            height={96}
            className="login-logo"
            priority
          />
        </div>

        <div className="login-title">
          <h1>Login</h1>
          <p>Unit Property Management System</p>
          <p>5 Signal Battalion</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>

          {message && (
            <div className="login-error" role="alert">
              {message}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="login-footer-note">Local LAN Access Only</div>
      </section>
    </main>
  );
}
