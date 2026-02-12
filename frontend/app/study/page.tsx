"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listQuestions, reviewQuestion, type Question } from "@/lib/api";

export default function StudyPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listQuestions({ due_only: true });
      setQuestions(data);
      setIndex(0);
      setShowAnswer(false);
    } catch (e: any) {
      setError(e?.message || "Failed to load due questions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDue();
  }, [loadDue]);

  const next = useCallback(() => {
    setShowAnswer(false);
    setIndex((prev) => {
      if (questions.length === 0) return 0;
      return (prev + 1) % questions.length;
    });
  }, [questions.length]);

  const prev = useCallback(() => {
    setShowAnswer(false);
    setIndex((prev) => {
      if (questions.length === 0) return 0;
      return (prev - 1 + questions.length) % questions.length;
    });
  }, [questions.length]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (submitting) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setShowAnswer(true);
      }
      if (showAnswer) {
        if (e.key === "1") void onRate("forgot");
        if (e.key === "2") void onRate("almost");
        if (e.key === "3") void onRate("knew");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev, showAnswer, submitting]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = questions[index];

  const progressText = useMemo(() => {
    if (questions.length === 0) return "0 / 0";
    return `${index + 1} / ${questions.length}`;
  }, [index, questions.length]);

  async function onRate(rating: "forgot" | "almost" | "knew") {
    if (!current) return;

    setSubmitting(true);
    setError(null);
    try {
      await reviewQuestion(current.id, rating);

      // Remove current from the due-queue (since it now has a future next_review_at)
      setQuestions((prev) => {
        const filtered = prev.filter((q) => q.id !== current.id);
        return filtered;
      });

      // Fix index after removal
      setIndex((prevIdx) => {
        const newLen = questions.length - 1;
        if (newLen <= 0) return 0;
        return Math.min(prevIdx, newLen - 1);
      });

      setShowAnswer(false);
    } catch (e: any) {
      setError(e?.message || "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-10">Loading due questions...</div>;

  if (questions.length === 0) {
    return (
      <div className="p-10">
        <div className="text-lg font-semibold">🎉 You’re done for now</div>
        <div className="text-gray-600 mt-2">
          No questions are due. Come back later or add more questions.
        </div>

        <div className="mt-6 flex gap-3">
          <Link href="/" className="px-3 py-2 rounded-lg border bg-white">
            ← Back
          </Link>
          <button onClick={loadDue} className="px-3 py-2 rounded-lg bg-black text-white">
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-white border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <Link href="/" className="text-sm text-gray-600">
            ← Back
          </Link>

          <div className="flex items-center gap-2">
            <button onClick={prev} className="text-sm px-3 py-1 rounded border bg-white">
              ← Prev
            </button>
            <button onClick={next} className="text-sm px-3 py-1 rounded border bg-white">
              Next →
            </button>
            <span className="text-sm text-gray-500 ml-2">{progressText}</span>
          </div>
        </div>

        {error && (
          <div className="mb-3 bg-white border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <h2 className="text-lg font-semibold">{current.question_text}</h2>

        {!showAnswer && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowAnswer(true)}
              className="py-3 bg-black text-white rounded-lg"
              disabled={submitting}
            >
              Show Answer (Space)
            </button>

            <button onClick={next} className="py-3 border rounded-lg bg-white" disabled={submitting}>
              Next →
            </button>
          </div>
        )}

        {showAnswer && (
          <>
            <div className="mt-4 p-4 bg-gray-100 rounded-lg whitespace-pre-wrap">
              {current.answer_md || "No answer added yet."}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <button
                onClick={() => onRate("forgot")}
                className="py-2 bg-red-500 text-white rounded-lg disabled:opacity-50"
                disabled={submitting}
              >
                Forgot (1)
              </button>
              <button
                onClick={() => onRate("almost")}
                className="py-2 bg-yellow-500 text-white rounded-lg disabled:opacity-50"
                disabled={submitting}
              >
                Almost (2)
              </button>
              <button
                onClick={() => onRate("knew")}
                className="py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                disabled={submitting}
              >
                Knew It (3)
              </button>
            </div>

            <p className="mt-4 text-xs text-gray-500">
              Shortcuts: Space=show • ←/→ prev/next • 1/2/3 = rate
            </p>
          </>
        )}
      </div>
    </main>
  );
}
