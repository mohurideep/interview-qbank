"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getDashboardStats, type DashboardStats } from "@/lib/api";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    async function load() {
      if (authLoading || !user) return;
      setLoading(true);
      setErr(null);
      try {
        const s = await getDashboardStats();
        setStats(s);
      } catch (e: any) {
        setErr(e?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  if (authLoading) {
    return <div className="p-10">Loading…</div>;
  }
  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-gray-600">Signed in as {user.email}</p>
          </div>

          <div className="flex gap-2">
            <Link href="/" className="px-3 py-2 rounded-lg border bg-white text-sm">
              ← Home
            </Link>
            <Link href="/study" className="px-3 py-2 rounded-lg border bg-white text-sm">
              Study
            </Link>
          </div>
        </header>

        {err && (
          <div className="mb-4 bg-white border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {err}
          </div>
        )}

        {loading && (
          <div className="text-gray-600 bg-white border rounded-lg p-6">Loading stats…</div>
        )}

        {!loading && stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card title="Total Questions" value={stats.total_questions} />
              <Card title="Due Now" value={stats.due_now} />
              <Card title="Avg Mastery" value={stats.avg_mastery.toFixed(2)} />
              <Card title="Total Reviews" value={stats.total_reviews} />
            </div>

            <div className="mt-6 bg-white border rounded-lg p-4">
              <h2 className="font-semibold">Weakest Tags</h2>
              <p className="text-sm text-gray-600 mt-1">
                Lowest average mastery across tagged questions.
              </p>

              {stats.weakest_tags.length === 0 ? (
                <div className="mt-4 text-gray-600">No tags yet.</div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-2">Tag</th>
                        <th className="py-2">Avg mastery</th>
                        <th className="py-2">Questions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.weakest_tags.map((t) => (
                        <tr key={t.name} className="border-t">
                          <td className="py-2 font-medium">{t.name}</td>
                          <td className="py-2">{t.avg_mastery.toFixed(2)}</td>
                          <td className="py-2">{t.question_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4">
                <Link
                  href="/study"
                  className="inline-block px-3 py-2 rounded-lg bg-black text-white text-sm"
                >
                  Start a review session
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
