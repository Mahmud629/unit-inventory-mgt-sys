"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/app/components/I18nProvider";
import { Field } from "@/app/components/ui";
import { localizeMessage } from "@/lib/i18n";

// Only allow redirects back into this app.
function safeNext() {
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();

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
        setMessage(data.message ? localizeMessage(data.message, lang) : t("loginFailed"));
        setLoading(false);
        return;
      }

      router.replace(safeNext());
      router.refresh();
    } catch {
      setMessage(t("cannotReach"));
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            title={t("langTitle")}
          >
            {t("langButton")}
          </button>
        </div>

        <Image
          src="/logo.png"
          alt="5 Sig Bn — UIMS, Unit Inventory Management System"
          width={220}
          height={220}
          className="login-logo"
          priority
        />
        <p className="sub">{t("loginPrompt")}</p>

        <form onSubmit={handleLogin} className="login-form form form-single">
          <Field label={t("username")}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>

          <Field label={t("password")}>
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
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? t("hide") : t("show")}
              </button>
            </div>
          </Field>

          {message && (
            <div className="login-error" role="alert">
              {message}
            </div>
          )}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? t("loggingIn") : t("login")}
          </button>
        </form>

        <p className="login-note">{t("lanOnly")}</p>
      </section>
    </main>
  );
}
