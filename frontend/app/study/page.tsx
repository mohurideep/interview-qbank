"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listQuestions, reviewQuestion, type Question } from "@/lib/api";

type Mode = "due" | "all";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function StudyPage() {
  const [mode, setMode] = useState<Mode>("due");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const childrenByParentId = useMemo(() => {
    const grouped = new Map<string, Question[]>();
    for (const q of questions) {
      if (!q.parent_id || !questionById.has(q.parent_id)) continue;
      const list = grouped.get(q.parent_id) || [];
      list.push(q);
      grouped.set(q.parent_id, list);
    }
    return grouped;
  }, [questions, questionById]);

  const orderedQuestions = useMemo(() => {
    const roots = questions.filter((q) => !q.parent_id || !questionById.has(q.parent_id));
    const ordered: Question[] = [];
    const seen = new Set<string>();

    function visit(node: Question) {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      ordered.push(node);
      const children = childrenByParentId.get(node.id) || [];
      for (const child of children) visit(child);
    }

    for (const root of roots) visit(root);
    for (const q of questions) visit(q);

    return ordered;
  }, [questions, questionById, childrenByParentId]);

  const depthById = useMemo(() => {
    const depths = new Map<string, number>();

    const computeDepth = (id: string): number => {
      if (depths.has(id)) return depths.get(id) || 0;
      const q = questionById.get(id);
      if (!q || !q.parent_id || !questionById.has(q.parent_id)) {
        depths.set(id, 0);
        return 0;
      }
      const depth = computeDepth(q.parent_id) + 1;
      depths.set(id, depth);
      return depth;
    };

    for (const q of questions) computeDepth(q.id);
    return depths;
  }, [questions, questionById]);

  const descendantCountById = useMemo(() => {
    const memo = new Map<string, number>();
    const visiting = new Set<string>();

    const countDescendants = (id: string): number => {
      if (memo.has(id)) return memo.get(id) || 0;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      let total = 0;
      const children = childrenByParentId.get(id) || [];
      for (const child of children) {
        total += 1 + countDescendants(child.id);
      }
      visiting.delete(id);
      memo.set(id, total);
      return total;
    };

    for (const q of questions) countDescendants(q.id);
    return memo;
  }, [questions, childrenByParentId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = mode === "due" ? await listQuestions({ due_only: true }) : await listQuestions();
      setQuestions(data);
      setIndex(0);
      setShowAnswer(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load questions"));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setIndex((prev) => {
      if (orderedQuestions.length === 0) return 0;
      return Math.min(prev, orderedQuestions.length - 1);
    });
  }, [orderedQuestions]);

  const next = useCallback(() => {
    setShowAnswer(false);
    setIndex((prev) => {
      if (orderedQuestions.length === 0) return 0;
      return (prev + 1) % orderedQuestions.length;
    });
  }, [orderedQuestions.length]);

  const prev = useCallback(() => {
    setShowAnswer(false);
    setIndex((prev) => {
      if (orderedQuestions.length === 0) return 0;
      return (prev - 1 + orderedQuestions.length) % orderedQuestions.length;
    });
  }, [orderedQuestions.length]);

  const current = orderedQuestions[index];
  const currentDepth = current ? depthById.get(current.id) || 0 : 0;
  const currentParent = current?.parent_id ? questionById.get(current.parent_id) : null;
  const currentFollowupCount = current ? descendantCountById.get(current.id) || 0 : 0;

  const progressText = useMemo(() => {
    if (orderedQuestions.length === 0) return "0 / 0";
    return `${index + 1} / ${orderedQuestions.length}`;
  }, [index, orderedQuestions.length]);

  async function onRate(rating: "forgot" | "almost" | "knew") {
    if (!current) return;

    setSubmitting(true);
    setError(null);
    try {
      await reviewQuestion(current.id, rating);

      if (mode === "due") {
        setQuestions((prevQ) => {
          const nextQ = prevQ.filter((q) => q.id !== current.id);
          setIndex((prevIdx) => {
            if (nextQ.length === 0) return 0;
            return Math.min(prevIdx, nextQ.length - 1);
          });
          return nextQ;
        });
        setShowAnswer(false);
      } else {
        next();
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Review failed"));
    } finally {
      setSubmitting(false);
    }
  }

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

  if (loading) return <div className="p-10">Loading questions...</div>;

  if (orderedQuestions.length === 0) {
    return (
      <div className="p-10">
        <div className="text-lg font-semibold">
          {mode === "due" ? "You are done for now" : "No questions found"}
        </div>
        <div className="text-gray-600 mt-2">
          {mode === "due"
            ? "No questions are due. Switch to All mode to practice everything."
            : "Add some questions and come back."}
        </div>

        <div className="mt-6 flex gap-3 items-center">
          <Link href="/" className="px-3 py-2 rounded-lg border bg-white">
            &lt;- Back
          </Link>

          <button
            onClick={() => setMode((m) => (m === "due" ? "all" : "due"))}
            className="px-3 py-2 rounded-lg border bg-white"
          >
            Mode: {mode === "due" ? "Due" : "All"}
          </button>

          <button onClick={load} className="px-3 py-2 rounded-lg bg-black text-white">
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
            &lt;- Back
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode((m) => (m === "due" ? "all" : "due"))}
              className="text-sm px-3 py-1 rounded border bg-white"
              disabled={submitting}
              title="Toggle Due vs All"
            >
              Mode: {mode === "due" ? "Due" : "All"}
            </button>

            <button
              onClick={load}
              className="text-sm px-3 py-1 rounded border bg-white"
              disabled={submitting}
            >
              Refresh
            </button>

            <button
              onClick={prev}
              className="text-sm px-3 py-1 rounded border bg-white"
              disabled={submitting}
            >
              &lt;- Prev
            </button>

            <button
              onClick={next}
              className="text-sm px-3 py-1 rounded border bg-white"
              disabled={submitting}
            >
              Next -&gt;
            </button>

            <span className="text-sm text-gray-500 ml-2">{progressText}</span>
          </div>
        </div>

        {error && (
          <div className="mb-3 bg-white border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`px-2 py-1 rounded ${
              currentDepth === 0 ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
            }`}
          >
            {currentDepth === 0 ? "Parent" : `Follow-up L${currentDepth}`}
          </span>

          {currentFollowupCount > 0 && (
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
              {currentFollowupCount} follow-up{currentFollowupCount === 1 ? "" : "s"}
            </span>
          )}

          {currentParent && (
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
              Parent: {currentParent.question_text}
            </span>
          )}
        </div>

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

            <button
              onClick={next}
              className="py-3 border rounded-lg bg-white"
              disabled={submitting}
            >
              Next -&gt;
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
              Mode: {mode === "due" ? "Due (spaced repetition)" : "All (practice)"} • Space=show •
              Left/Right prev/next • 1/2/3 = rate
            </p>
          </>
        )}
      </div>
    </main>
  );
}
