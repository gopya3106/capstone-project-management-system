"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sends a JSON request, surfaces the server's message, and refreshes the
 * server-rendered page on success so every table shows the new database state.
 */
export function useApiAction() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    url: string,
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    body?: unknown
  ): Promise<Record<string, unknown> | null> {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        const fieldErrors = data.errors
          ? Object.entries(data.errors as Record<string, string[]>)
              .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
              .join("; ")
          : "";
        setError([data.message || `Request failed (${res.status}).`, fieldErrors].filter(Boolean).join(" "));
        return null;
      }
      setMessage(data.message || "Saved.");
      router.refresh();
      return data;
    } catch {
      setError("Could not reach the server. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { run, loading, error, message, setError, setMessage };
}
