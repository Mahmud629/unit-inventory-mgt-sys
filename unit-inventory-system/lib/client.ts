"use client";

// Browser helpers: API calls with consistent error handling, uploads with
// image compression, and a toast message hook.
import { useCallback, useEffect, useRef, useState } from "react";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });

  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new Error("Session expired. Please log in again.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "Request failed.");
  }

  return data as T;
}

export function sendJson<T>(url: string, method: string, body: unknown) {
  return api<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Phone photos are often 1–5 MB. Shrink large JPG/PNG images to at most
// 1600px before upload; PDFs and small images are sent as they are.
const MAX_SIDE = 1600;

async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.fillStyle = "#fff"; // transparent PNG areas become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );

    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadFile(file: File | null, existingUrl: string) {
  if (!file) return existingUrl;

  const fd = new FormData();
  fd.append("file", await compressImage(file));

  const data = await api<{ url: string }>("/api/upload", { method: "POST", body: fd });
  return data.url;
}

export function useToast(duration = 3000) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback(
    (text: string) => {
      clearTimeout(timer.current);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(""), duration);
    },
    [duration]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return [message, show] as const;
}

export function errorText(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}

// Close modals with the Escape key.
export function useEscape(onEscape: (() => void) | null) {
  useEffect(() => {
    if (!onEscape) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape]);
}
