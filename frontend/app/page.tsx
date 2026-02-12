"use client";

import { useEffect, useMemo, useState } from "react";
import type { Question, QuestionCreate } from "@/lib/api";
import { createQuestion, listQuestions } from "@/lib/api";

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<QuestionCreate>({
    question_text: "",
    answer_md: "",
    difficulty: 3,
    source: "",
    tags: [],
  });
  const [tagsText, setTagsText] = useState(""); // comma separated
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await listQuestions({ search: q?.trim() || undefined });
      setQuestions(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const countText = useMemo(() => `${questions.length} questions`, [questions.length]);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: QuestionCreate = {
        ...form,
        tags,
      };

      await createQuestion(payload);

      // reset + refresh
      setForm({ question_text: "", answer_md: "", difficulty: 3, source: "", tags: [] });
      setTagsText("");
      setShowAdd(false);
      await refresh(search);
    } catch (e: any) {
      setError(e?.message || "Failed to create question");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* <header className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Interview QBank</h1>
            <p className="text-sm text-gray-600">{countText}</p>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-2 rounded-lg bg-black text-white text-sm"
          >
            + Add
          </button>
        </header> */}
        <header className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Interview QBank</h1>
          <p className="text-sm text-gray-600">{countText}</p>
        </div>

        <div className="flex gap-2">
          <a
            href="/study"
            className="px-3 py-2 rounded-lg border bg-white text-sm"
          >
            Study
          </a>

          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-2 rounded-lg bg-black text-white text-sm"
          >
            + Add
          </button>
        </div>
        </header>

        {/* Search */}
        <div className="mb-4 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="flex-1 border rounded-lg px-3 py-2 bg-white"
          />
          <button
            onClick={() => refresh(search)}
            className="px-3 py-2 rounded-lg border bg-white text-sm"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearch("");
              refresh("");
            }}
            className="px-3 py-2 rounded-lg border bg-white text-sm"
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-white border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {loading && (
            <div className="text-gray-600 bg-white border rounded-lg p-6">
              Loading…
            </div>
          )}

          {!loading && questions.length === 0 && (
            <div className="text-gray-600 bg-white border rounded-lg p-6">
              No questions yet. Click <b>+ Add</b> to create one.
            </div>
          )}

          {questions.map((q) => {
            const expanded = expandedId === q.id;
            return (
              <div key={q.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-semibold">{q.question_text}</h2>
                  <span className="text-xs px-2 py-1 rounded bg-gray-100">
                    L{q.difficulty}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {q.tags.map((t) => (
                    <span key={t} className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {t}
                    </span>
                  ))}
                </div>

                {q.source && (
                  <p className="mt-2 text-xs text-gray-500">Source: {q.source}</p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setExpandedId(expanded ? null : q.id)}
                    className="text-sm px-3 py-2 rounded-lg border bg-white"
                  >
                    {expanded ? "Hide answer" : "Show answer"}
                  </button>
                </div>

                {expanded && (
                  <div className="mt-3 whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border rounded-lg p-3">
                    {q.answer_md || "No answer added yet."}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Add Question</h3>
                <button
                  onClick={() => setShowAdd(false)}
                  className="text-sm px-3 py-2 rounded-lg border bg-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-700">Question</label>
                  <textarea
                    value={form.question_text}
                    onChange={(e) => setForm((p) => ({ ...p, question_text: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-700">Answer (markdown/plain)</label>
                  <textarea
                    value={form.answer_md}
                    onChange={(e) => setForm((p) => ({ ...p, answer_md: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-gray-700">Difficulty (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={form.difficulty}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, difficulty: Number(e.target.value) || 3 }))
                      }
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-700">Source</label>
                    <input
                      value={form.source}
                      onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., Google, Interview @ X, Self-study"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-700">Tags (comma separated)</label>
                  <input
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    placeholder="ml, basics, llm, rag"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="text-sm px-3 py-2 rounded-lg border bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={submitting || form.question_text.trim().length < 3}
                    className="text-sm px-3 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
