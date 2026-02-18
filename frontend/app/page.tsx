"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Question, QuestionCreate, QuestionUpdate } from "@/lib/api";
import { createQuestion, listQuestions, updateQuestion, deleteQuestion } from "@/lib/api";
import MarkdownAnswer from "@/components/MarkdownAnswer";

type Mode = "add" | "edit";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<Mode>("add");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<QuestionCreate>({
    parent_id: null,
    question_text: "",
    answer_md: "",
    difficulty: 3,
    source: "",
    tags: [],
  });

  const [tagsText, setTagsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topLevelOnly, setTopLevelOnly] = useState(false);
  const [collapsedThreadIds, setCollapsedThreadIds] = useState<Set<string>>(new Set());
  const [collapseAllThreads, setCollapseAllThreads] = useState(false);
  const [uiReady, setUiReady] = useState(false);
  const buttonBase =
    "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium leading-none transition-all duration-200";
  const buttonSecondary = `${buttonBase} border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400`;
  const buttonPrimary = `${buttonBase} bg-amber-700 text-amber-50 hover:bg-amber-800 shadow-sm`;
  const buttonDanger = `${buttonBase} border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100`;

  const searchTerms = useMemo(
    () => Array.from(new Set(search.toLowerCase().trim().split(/\s+/).filter(Boolean))),
    [search]
  );

  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const childrenByParentId = useMemo(() => {
    const grouped = new Map<string, Question[]>();
    for (const q of questions) {
      if (!q.parent_id) continue;
      const list = grouped.get(q.parent_id) || [];
      list.push(q);
      grouped.set(q.parent_id, list);
    }
    return grouped;
  }, [questions]);

  const topLevelQuestions = useMemo(() => questions.filter((q) => !q.parent_id), [questions]);
  const orphanFollowups = useMemo(
    () => questions.filter((q) => q.parent_id && !questionById.has(q.parent_id)),
    [questions, questionById]
  );
  const displayedRoots = topLevelQuestions;

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

  const countText = useMemo(() => {
    const visible = displayedRoots.length;
    if (!topLevelOnly) return `${questions.length} questions`;
    return `${visible} top-level shown (${questions.length} total)`;
  }, [displayedRoots.length, questions.length, topLevelOnly]);

  async function refresh(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await listQuestions({ search: q?.trim() || undefined });
      setQuestions(data);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load questions"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setUiReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    setCollapsedThreadIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (questionById.has(id)) next.add(id);
      }
      return next;
    });
  }, [questionById]);

  function openAdd(parentId: string | null = null) {
    setMode("add");
    setEditingId(null);
    setForm({
      parent_id: parentId,
      question_text: "",
      answer_md: "",
      difficulty: 3,
      source: "",
      tags: [],
    });
    setTagsText("");
    setShowModal(true);
  }

  function openEdit(q: Question) {
    setMode("edit");
    setEditingId(q.id);
    setForm({
      parent_id: q.parent_id ?? null,
      question_text: q.question_text || "",
      answer_md: q.answer_md || "",
      difficulty: q.difficulty || 3,
      source: q.source || "",
      tags: q.tags || [],
    });
    setTagsText((q.tags || []).join(", "));
    setShowModal(true);
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (mode === "add") {
        const payload: QuestionCreate = { ...form, parent_id: form.parent_id ?? null, tags };
        await createQuestion(payload);
      } else {
        if (!editingId) throw new Error("Missing question id for edit");
        const payload: QuestionUpdate = { ...form, parent_id: form.parent_id ?? null, tags };
        await updateQuestion(editingId, payload);
      }

      setShowModal(false);
      await refresh(search);
    } catch (error: unknown) {
      const fallback = mode === "add" ? "Failed to create question" : "Failed to update question";
      setError(getErrorMessage(error, fallback));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm("Delete this question? This cannot be undone.");
    if (!ok) return;

    setError(null);
    try {
      await deleteQuestion(id);
      setExpandedId((cur) => (cur === id ? null : cur));
      await refresh(search);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to delete question"));
    }
  }

  function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightMatches(text: string): ReactNode {
    if (!text || searchTerms.length === 0) return text;

    const pattern = searchTerms.map(escapeRegExp).join("|");
    if (!pattern) return text;

    const regex = new RegExp(`(${pattern})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      const matched = searchTerms.includes(part.toLowerCase());
      if (!matched) return <span key={idx}>{part}</span>;
      return (
        <mark key={idx} className="bg-amber-200/90 rounded px-0.5">
          {part}
        </mark>
      );
    });
  }

  function toggleThread(id: string) {
    setCollapseAllThreads(false);
    setCollapsedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderQuestionCard(q: Question, isFollowup: boolean) {
    const expanded = expandedId === q.id;
    const parent = q.parent_id ? questionById.get(q.parent_id) : undefined;
    const roleText = isFollowup ? "Follow-up" : "Parent";
    const followupCount = descendantCountById.get(q.id) || 0;
    const hasFollowups = followupCount > 0;
    const threadCollapsed = collapsedThreadIds.has(q.id);

    return (
      <div
        key={q.id}
        className={`rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
          isFollowup
            ? "bg-amber-50/60 border-amber-200 border-l-4 border-l-amber-500"
            : "bg-white/95 border-amber-200"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-semibold text-stone-900">{highlightMatches(q.question_text)}</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-900">
            L{q.difficulty}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              isFollowup ? "bg-orange-100 text-orange-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {roleText}
          </span>

          {hasFollowups && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800">
              {followupCount} follow-up{followupCount === 1 ? "" : "s"}
            </span>
          )}

          {q.tags.map((t) => (
            <span key={t} className="text-xs bg-stone-100 text-stone-700 px-2 py-1 rounded-full">
              {t}
            </span>
          ))}
        </div>

        {q.parent_id && (
          <p className="mt-2 text-xs text-stone-600">
            Child of: {" "}
            {parent?.question_text ? highlightMatches(parent.question_text) : "Parent not in current list"}
          </p>
        )}

        {q.source && <p className="mt-2 text-xs text-stone-600">Source: {q.source}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setExpandedId(expanded ? null : q.id)} className={buttonSecondary}>
            {expanded ? "Hide answer" : "Show answer"}
          </button>

          <button onClick={() => openEdit(q)} className={buttonSecondary}>
            Edit
          </button>

          <button onClick={() => openAdd(q.id)} className={buttonSecondary}>
            Add follow-up
          </button>

          {!topLevelOnly && hasFollowups && (
            <button onClick={() => toggleThread(q.id)} className={buttonSecondary}>
              {threadCollapsed ? "Expand thread" : "Collapse thread"} {threadCollapsed ? "▸" : "▾"}
            </button>
          )}

          <button onClick={() => onDelete(q.id)} className={buttonDanger}>
            Delete
          </button>
        </div>

        {expanded && (
          <MarkdownAnswer
            className="mt-3 text-sm text-stone-800 bg-amber-50/70 border border-amber-200 rounded-xl p-3 animate-[fadeIn_220ms_ease-out]"
            content={q.answer_md || "No answer added yet."}
          />
        )}
      </div>
    );
  }

  function renderFollowups(parentId: string, depth = 1, seen = new Set<string>()) {
    const followups = childrenByParentId.get(parentId) || [];
    if (followups.length === 0) return null;
    const isCollapsed = topLevelOnly || collapseAllThreads || collapsedThreadIds.has(parentId);

    const nextSeen = new Set(seen);
    nextSeen.add(parentId);

    return (
      <div
        aria-hidden={isCollapsed}
        style={{
          maxHeight: isCollapsed ? 0 : 2400,
          opacity: isCollapsed ? 0 : 1,
          transform: isCollapsed ? "translateY(-8px)" : "translateY(0)",
          overflow: "hidden",
          transition: "max-height 320ms ease, opacity 220ms ease, transform 260ms ease",
        }}
      >
        <div
          className={`overflow-hidden space-y-2 ${
            depth === 1
              ? "ml-5 pl-4 border-l-2 border-amber-300 bg-amber-50/50 rounded-r-xl py-2"
              : "ml-4 pl-4 border-l border-amber-200"
          }`}
        >
          {followups.map((child) => (
            <div key={child.id} className="space-y-2">
              {renderQuestionCard(child, true)}
              {!nextSeen.has(child.id) && renderFollowups(child.id, depth + 1, nextSeen)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/35 to-rose-50/25">
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
      <div className="max-w-5xl mx-auto p-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 rounded-2xl border border-amber-200 bg-white/80 backdrop-blur p-5 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-amber-700/80 mb-1">Knowledge Workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Interview QBank</h1>
            <p className="text-sm text-stone-600 mt-1">{countText}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href="/study" className={buttonSecondary}>
              Study
            </a>
            <a href="/dashboard" className={buttonSecondary}>
              Dashboard
            </a>
            <button onClick={() => openAdd()} className={buttonPrimary}>
              + Add
            </button>
          </div>
        </header>

        <div className="mb-4 rounded-2xl border border-amber-200 bg-white/90 p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="flex-1 min-w-[240px] border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/40 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              onClick={() => refresh(search)}
              className={buttonSecondary}
            >
              Search
            </button>
            <button
              onClick={() => {
                setSearch("");
                void refresh("");
              }}
              className={buttonSecondary}
            >
              Clear
            </button>
            <button
              onClick={() => setTopLevelOnly((v) => !v)}
              className={`${buttonBase} border ${
                topLevelOnly
                  ? "bg-amber-700 text-amber-50 border-amber-700"
                  : "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
              }`}
              title="Show only questions without a parent"
            >
              Top-level only
            </button>
            {!topLevelOnly && (
              <>
                <button
                  onClick={() => setCollapseAllThreads(true)}
                  className={buttonSecondary}
                >
                  Collapse all threads
                </button>
                <button
                  onClick={() => {
                    setCollapseAllThreads(false);
                    setCollapsedThreadIds(new Set());
                  }}
                  className={buttonSecondary}
                >
                  Expand all threads
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm shadow-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {loading && (
            <div className="text-stone-600 bg-white/90 border border-amber-200 rounded-xl p-6">
              Loading...
            </div>
          )}

          {!loading && questions.length === 0 && (
            <div className="text-stone-600 bg-white/90 border border-amber-200 rounded-xl p-6">
              No questions yet. Click <b>+ Add</b> to create one.
            </div>
          )}

          {!loading && questions.length > 0 && topLevelOnly && (
            <div className="text-xs text-stone-600 bg-white/90 border border-amber-200 rounded-xl p-3">
              Showing only top-level questions that have no parent.
            </div>
          )}

          {!loading && questions.length > 0 && displayedRoots.length === 0 && (
            <div className="text-stone-600 bg-white/90 border border-amber-200 rounded-xl p-6">
              No top-level questions match your current search.
            </div>
          )}

          {displayedRoots.map((q, idx) => (
            <div
              key={q.id}
              className={`space-y-2 transition-all duration-500 ${uiReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
              style={{ transitionDelay: `${Math.min(idx * 40, 220)}ms` }}
            >
              <div className="flex items-center gap-2 pl-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.12)]" />
                <p className="text-xs font-medium text-amber-800/80">Thread</p>
              </div>
              {renderQuestionCard(q, false)}
              {renderFollowups(q.id)}
            </div>
          ))}

          {!loading && !topLevelOnly && orphanFollowups.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500 px-1">Unlinked follow-ups</div>
              {orphanFollowups.map((q) => (
                <div key={q.id}>{renderQuestionCard(q, true)}</div>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-stone-900/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-amber-200 shadow-xl p-4 animate-[fadeIn_180ms_ease-out]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{mode === "add" ? "Add Question" : "Edit Question"}</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className={buttonSecondary}
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-stone-700">Question</label>
                  <textarea
                    value={form.question_text}
                    onChange={(e) => setForm((p) => ({ ...p, question_text: e.target.value }))}
                    className="mt-1 w-full border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/30"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm text-stone-700">Answer (markdown/plain)</label>
                  <textarea
                    value={form.answer_md}
                    onChange={(e) => setForm((p) => ({ ...p, answer_md: e.target.value }))}
                    className="mt-1 w-full border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/30"
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <label className="text-sm text-stone-700">Parent question (optional)</label>
                    <select
                      value={form.parent_id ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value || null }))}
                      className="mt-1 w-full border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/30"
                    >
                      <option value="">None (top-level question)</option>
                      {questions
                        .filter((q) => q.id !== editingId)
                        .map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.question_text}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-stone-700">Difficulty (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={form.difficulty}
                      onChange={(e) => setForm((p) => ({ ...p, difficulty: Number(e.target.value) || 3 }))}
                      className="mt-1 w-full border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/30"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm text-stone-700">Source</label>
                    <input
                      value={form.source}
                      onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                      className="mt-1 w-full border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/30"
                      placeholder="e.g., Google, Interview @ X, Self-study"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-stone-700">Tags (comma separated)</label>
                  <input
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    className="mt-1 w-full border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/30"
                    placeholder="ml, basics, llm, rag"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className={buttonSecondary}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={submitting || form.question_text.trim().length < 3}
                    className={`${buttonPrimary} disabled:opacity-50`}
                  >
                    {submitting
                      ? mode === "add"
                        ? "Saving..."
                        : "Updating..."
                      : mode === "add"
                        ? "Save"
                        : "Update"}
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
