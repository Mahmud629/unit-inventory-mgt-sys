"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/app/components/ui";

// Only allow redirects back into this app.
function safeNext() {
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setMessage("Cannot reach the server. Check the network and try again.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Image
          src="/logo.png"
          alt="5 Sig Bn — UIMS, Unit Inventory Management System"
          width={220}
          height={220}
          className="login-logo"
          priority
        />
        <p className="sub">5 Signal Battalion · Please log in</p>

        <form onSubmit={handleLogin} className="login-form form form-single">
          <Field label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Password">
            <div className="input-row">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          {message && (
            <div className="login-error" role="alert">
              {message}
            </div>
          )}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        <p className="login-note">Local LAN access only</p>
      </section>
    </main>
  );
}
