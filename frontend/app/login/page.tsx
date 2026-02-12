"use client";

import { useState } from "react";
import { login } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      // Cookie-based auth: backend sets HttpOnly cookies.
      // Response is typically { id, email }.
      await login(email, password);

      // Redirect after successful login
      r.push("/");
      r.refresh();
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Login</h1>

        {err && (
          <div className="mt-3 p-3 rounded-lg border border-red-200 text-red-700 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button
            className="w-full py-2 rounded-lg bg-black text-white disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          No account?{" "}
          <Link href="/register" className="text-blue-600">
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}
