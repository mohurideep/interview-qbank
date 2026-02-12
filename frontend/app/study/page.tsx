"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { listQuestions, type Question } from "@/lib/api";

export default function StudyPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  // navigation
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

  // initial load
  useEffect(() => {
    async function load() {
      try {
        const data = await listQuestions();
        setQuestions(data);
        setIndex(0);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setShowAnswer(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev]);

  if (loading) {
    return <div className="p-10">Loading study session...</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="p-10">
        <div>No questions available.</div>
        <Link href="/" className="inline-block mt-4 text-blue-600">
          ← Back
        </Link>
      </div>
    );
  }

  const current = questions[index];

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white border rounded-xl p-6 shadow-sm">
        {/* Single header */}
        <div className="flex justify-between items-center mb-4">
          <Link href="/" className="text-sm text-gray-600">
            ← Back
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              className="text-sm px-3 py-1 rounded border bg-white"
            >
              ← Prev
            </button>
            <button
              onClick={next}
              className="text-sm px-3 py-1 rounded border bg-white"
            >
              Next →
            </button>
            <span className="text-sm text-gray-500 ml-2">
              {index + 1} / {questions.length}
            </span>
          </div>
        </div>

        <h2 className="text-lg font-semibold">{current.question_text}</h2>

        {!showAnswer && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowAnswer(true)}
              className="py-3 bg-black text-white rounded-lg"
            >
              Show Answer
            </button>

            <button onClick={next} className="py-3 border rounded-lg bg-white">
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
                onClick={next}
                className="py-2 bg-red-500 text-white rounded-lg"
              >
                Forgot
              </button>
              <button
                onClick={next}
                className="py-2 bg-yellow-500 text-white rounded-lg"
              >
                Almost
              </button>
              <button
                onClick={next}
                className="py-2 bg-green-600 text-white rounded-lg"
              >
                Knew It
              </button>
            </div>

            <p className="mt-4 text-xs text-gray-500">
              Shortcuts: Space = show answer • ←/→ = prev/next
            </p>
          </>
        )}
      </div>
    </main>
  );
}
