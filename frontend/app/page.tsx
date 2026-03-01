"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Question, QuestionCreate, QuestionUpdate } from "@/lib/api";
import {
  createQuestion,
  listQuestions,
  updateQuestion,
  deleteQuestion,
  getQuestionSuggestions,
  exportQuestionsDocx,
  reorderChildren,
} from "@/lib/api";
import MarkdownAnswer from "@/components/MarkdownAnswer";

type Mode = "add" | "edit";
const IST_TIME_ZONE = "Asia/Kolkata";

function DownloadIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2h16v-2" />
    </svg>
  );
}

function CopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");

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
  const [sourceSuggestions, setSourceSuggestions] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topLevelOnly, setTopLevelOnly] = useState(false);
  const [collapsedThreadIds, setCollapsedThreadIds] = useState<Set<string>>(new Set());
  const [focusedThreadId, setFocusedThreadId] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingThreadId, setExportingThreadId] = useState<string | null>(null);
  const [markingStudiedThreadId, setMarkingStudiedThreadId] = useState<string | null>(null);
  const [historyOpenThreadIds, setHistoryOpenThreadIds] = useState<Set<string>>(new Set());
  const [studiedDialogThreadId, setStudiedDialogThreadId] = useState<string | null>(null);
  const [studiedDialogValue, setStudiedDialogValue] = useState("");
  const [draggedChild, setDraggedChild] = useState<{ childId: string; parentId: string } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ parentId: string; index: number } | null>(null);
  const [reorderingParentId, setReorderingParentId] = useState<string | null>(null);
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);
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
    for (const [parentId, list] of grouped.entries()) {
      list.sort((a, b) => {
        const orderDiff = (a.child_order ?? 0) - (b.child_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        if (a.created_at === b.created_at) return a.id.localeCompare(b.id);
        return a.created_at.localeCompare(b.created_at);
      });
      grouped.set(parentId, list);
    }
    return grouped;
  }, [questions]);

  const topLevelQuestions = useMemo(() => questions.filter((q) => !q.parent_id), [questions]);
  const orphanFollowups = useMemo(
    () => questions.filter((q) => q.parent_id && !questionById.has(q.parent_id)),
    [questions, questionById]
  );
  const displayedRoots = useMemo(() => {
    if (!focusedThreadId) return topLevelQuestions;
    const focused = topLevelQuestions.find((q) => q.id === focusedThreadId);
    return focused ? [focused] : topLevelQuestions;
  }, [topLevelQuestions, focusedThreadId]);
  const sourceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          questions
            .map((q) => q.source?.trim())
            .filter((s): s is string => Boolean(s))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [questions]
  );
  const tagOptions = useMemo(
    () =>
      Array.from(new Set(questions.flatMap((q) => q.tags || []).map((t) => t.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [questions]
  );

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

  async function refresh(filters?: { search?: string; source?: string; tags?: string }) {
    setLoading(true);
    setError(null);
    try {
      const data = await listQuestions({
        search: filters?.search?.trim() || undefined,
        source: filters?.source?.trim() || undefined,
        tags: filters?.tags
          ?.split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .join(",") || undefined,
      });
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

  useEffect(() => {
    if (!focusedThreadId) return;
    if (!questionById.has(focusedThreadId)) setFocusedThreadId(null);
  }, [focusedThreadId, questionById]);

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
    setSourceSuggestions([]);
    setTagSuggestions([]);
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
    setSourceSuggestions([]);
    setTagSuggestions([]);
    setShowModal(true);
  }

  const activeTagToken = useMemo(() => {
    const parts = tagsText.split(",");
    return (parts[parts.length - 1] || "").trim();
  }, [tagsText]);

  useEffect(() => {
    if (!showModal) return;
    const query = form.source.trim();
    if (!query) {
      setSourceSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      void getQuestionSuggestions("source", query, 8)
        .then((items) => setSourceSuggestions(items))
        .catch(() => setSourceSuggestions([]));
    }, 180);

    return () => clearTimeout(timer);
  }, [showModal, form.source]);

  useEffect(() => {
    if (!showModal) return;
    if (!activeTagToken) {
      setTagSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      void getQuestionSuggestions("tag", activeTagToken, 8)
        .then((items) => setTagSuggestions(items))
        .catch(() => setTagSuggestions([]));
    }, 180);

    return () => clearTimeout(timer);
  }, [showModal, activeTagToken]);

  function applyTagSuggestion(tag: string) {
    const normalized = tag.trim();
    if (!normalized) return;

    const existing = tagsText
      .split(",")
      .slice(0, -1)
      .map((t) => t.trim())
      .filter(Boolean);
    const merged = [...existing, normalized];
    setTagsText(`${merged.join(", ")}, `);
    setTagSuggestions([]);
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
      await refresh({ search, source: sourceFilter, tags: tagsFilter });
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
      await refresh({ search, source: sourceFilter, tags: tagsFilter });
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to delete question"));
    }
  }

  async function onMoveChildToTopLevel(id: string) {
    setError(null);
    try {
      await updateQuestion(id, { parent_id: null });
      await refresh({ search, source: sourceFilter, tags: tagsFilter });
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to move question out of parent"));
    } finally {
      clearDragState();
    }
  }

  async function onCopyQuestionAndAnswer(q: Question) {
    const payload = `Question:\n${q.question_text}\n\nAnswer:\n${q.answer_md || "No answer added yet."}`;
    setError(null);
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedQuestionId(q.id);
      window.setTimeout(() => {
        setCopiedQuestionId((current) => (current === q.id ? null : current));
      }, 1400);
    } catch {
      setError("Failed to copy content to clipboard");
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 500);
  }

  async function onExportAll() {
    setExportingAll(true);
    setError(null);
    try {
      const blob = await exportQuestionsDocx({
        search: search.trim() || undefined,
        source: sourceFilter.trim() || undefined,
        tags:
          tagsFilter
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .join(",") || undefined,
      });
      downloadBlob(blob, `interview-qbank-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.docx`);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to export questions"));
    } finally {
      setExportingAll(false);
    }
  }

  async function onExportThread(threadId: string) {
    setExportingThreadId(threadId);
    setError(null);
    try {
      const blob = await exportQuestionsDocx({ thread_id: threadId });
      downloadBlob(blob, `thread-${threadId}.docx`);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to export thread"));
    } finally {
      setExportingThreadId((prev) => (prev === threadId ? null : prev));
    }
  }

  async function onMarkThreadStudied(threadId: string, studiedAtIso: string) {
    setMarkingStudiedThreadId(threadId);
    setError(null);
    let success = false;
    try {
      await updateQuestion(threadId, { studied_at: studiedAtIso });
      await refresh({ search, source: sourceFilter, tags: tagsFilter });
      success = true;
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to mark thread as studied"));
    } finally {
      setMarkingStudiedThreadId((prev) => (prev === threadId ? null : prev));
    }
    return success;
  }

  function formatStudiedAt(value: string | null) {
    if (!value) return "";
    const naiveMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (naiveMatch) {
      const year = Number(naiveMatch[1]);
      const month = Number(naiveMatch[2]);
      const day = Number(naiveMatch[3]);
      const hour24 = Number(naiveMatch[4]);
      const minute = Number(naiveMatch[5]);
      const second = Number(naiveMatch[6] || "0");

      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      const meridiem = hour24 >= 12 ? "pm" : "am";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(day)}/${pad(month)}/${year}, ${hour12}:${pad(minute)}:${pad(second)} ${meridiem}`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-IN", {
      timeZone: IST_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  function toIstDateTimeInputValue(isoValue: string) {
    const naiveMatch = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(isoValue);
    if (naiveMatch) return naiveMatch[1];

    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: IST_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const map = new Map(parts.map((part) => [part.type, part.value]));
    const year = map.get("year");
    const month = map.get("month");
    const day = map.get("day");
    const hour = map.get("hour");
    const minute = map.get("minute");

    if (!year || !month || !day || !hour || !minute) return "";
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function istDateTimeInputToIso(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00`;
  }

  function openStudiedDialog(q: Question) {
    const seedIso = q.studied_at || new Date().toISOString();
    setStudiedDialogThreadId(q.id);
    setStudiedDialogValue(toIstDateTimeInputValue(seedIso));
  }

  async function onSaveStudiedDateTime() {
    if (!studiedDialogThreadId || !studiedDialogValue) return;
    const selectedIso = istDateTimeInputToIso(studiedDialogValue);
    if (!selectedIso) {
      setError("Invalid date/time selected");
      return;
    }

    const saved = await onMarkThreadStudied(studiedDialogThreadId, selectedIso);
    if (saved) {
      setStudiedDialogThreadId(null);
      setStudiedDialogValue("");
    }
  }

  function toggleStudyHistory(threadId: string) {
    setHistoryOpenThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }

  function clearDragState() {
    setDraggedChild(null);
    setDragOverSlot(null);
  }

  function reorderIds(current: string[], draggedId: string, targetIndex: number): string[] {
    const filtered = current.filter((id) => id !== draggedId);
    const boundedIndex = Math.max(0, Math.min(targetIndex, filtered.length));
    filtered.splice(boundedIndex, 0, draggedId);
    return filtered;
  }

  async function onReorderChildren(parentId: string, orderedChildIds: string[]) {
    if (orderedChildIds.length <= 1) {
      clearDragState();
      return;
    }

    const previous = questions;
    setReorderingParentId(parentId);
    setError(null);

    setQuestions((prev) =>
      prev.map((q) => {
        if (q.parent_id !== parentId) return q;
        const nextIndex = orderedChildIds.indexOf(q.id);
        if (nextIndex < 0) return q;
        return { ...q, child_order: nextIndex };
      })
    );

    try {
      await reorderChildren(parentId, orderedChildIds);
    } catch (error: unknown) {
      setQuestions(previous);
      setError(getErrorMessage(error, "Failed to reorder child questions"));
    } finally {
      setReorderingParentId((current) => (current === parentId ? null : current));
      clearDragState();
    }
  }

  async function onMoveChildIntoQuestion(childId: string, newParentId: string) {
    if (childId === newParentId) {
      clearDragState();
      return;
    }

    setError(null);
    try {
      await updateQuestion(childId, { parent_id: newParentId });
      await refresh({ search, source: sourceFilter, tags: tagsFilter });
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to move question into target thread"));
    } finally {
      clearDragState();
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
    const isFocusedRoot = !isFollowup && focusedThreadId === q.id;
    const studiedCount = q.studied_count || 0;
    const isHistoryOpen = historyOpenThreadIds.has(q.id);

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
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <h2 className="font-semibold text-stone-900">{highlightMatches(q.question_text)}</h2>
            <button
              onClick={() => void onCopyQuestionAndAnswer(q)}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
                copiedQuestionId === q.id
                  ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                  : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
              title={copiedQuestionId === q.id ? "Copied" : "Copy question + answer"}
              aria-label={copiedQuestionId === q.id ? "Copied" : "Copy question and answer"}
            >
              {copiedQuestionId === q.id ? (
                <CheckIcon className="w-3.5 h-3.5" />
              ) : (
                <CopyIcon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
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
          {!isFollowup && studiedCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
              studied {studiedCount} time{studiedCount === 1 ? "" : "s"}
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
        {isFollowup && (
          <p className="mt-1 text-[11px] text-amber-700/80">
            Drag to reorder. Drop on another follow-up card to nest it inside that question.
          </p>
        )}

        {q.source && <p className="mt-2 text-xs text-stone-600">Source: {q.source}</p>}
        {!isFollowup && q.studied_at && (
          <p className="mt-2 text-xs text-emerald-700">Studied: {formatStudiedAt(q.studied_at)}</p>
        )}

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

          {!isFollowup && (
            <button
              onClick={() => setFocusedThreadId(isFocusedRoot ? null : q.id)}
              className={`${buttonBase} border ${
                isFocusedRoot
                  ? "bg-amber-700 text-amber-50 border-amber-700"
                  : "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
              }`}
              title="Show only this thread and all its follow-ups"
            >
              {isFocusedRoot ? "Exit focus" : "Focus thread"}
            </button>
          )}

          {!isFollowup && (
            <button
              onClick={() => openStudiedDialog(q)}
              className={buttonSecondary}
              title="Select a date and time to mark this parent thread as studied"
              disabled={markingStudiedThreadId === q.id}
            >
              {markingStudiedThreadId === q.id
                ? "Saving..."
                : q.studied_at
                  ? "Update studied time"
                  : "Mark studied"}
            </button>
          )}
          {!isFollowup && studiedCount > 0 && (
            <button
              onClick={() => toggleStudyHistory(q.id)}
              className={buttonSecondary}
              title="Show study history for this thread"
            >
              {isHistoryOpen ? "Hide history" : "Show history"}
            </button>
          )}

          {!isFollowup && (
            <button
              onClick={() => onExportThread(q.id)}
              className={buttonSecondary}
              title="Export this thread to Word (.docx)"
              disabled={exportingThreadId === q.id}
            >
              <DownloadIcon className="w-4 h-4 mr-1.5" />
              {exportingThreadId === q.id ? "Exporting..." : "Export thread"}
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
        {!isFollowup && isHistoryOpen && studiedCount > 0 && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-xs font-medium text-emerald-800 mb-2">
              Study history ({studiedCount})
            </p>
            <div className="space-y-1">
              {q.studied_history.map((entry, idx) => (
                <p key={`${q.id}-study-${idx}`} className="text-xs text-emerald-700">
                  {idx + 1}. {formatStudiedAt(entry)}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderFollowups(parentId: string, depth = 1, seen = new Set<string>()) {
    const followups = childrenByParentId.get(parentId) || [];
    if (followups.length === 0) return null;
    const isCollapsed = topLevelOnly || collapsedThreadIds.has(parentId);
    const isActiveDragParent = draggedChild?.parentId === parentId;
    const isBusy = reorderingParentId === parentId;

    const nextSeen = new Set(seen);
    nextSeen.add(parentId);

    return (
      <div
        aria-hidden={isCollapsed}
        style={{
          maxHeight: isCollapsed ? 0 : "none",
          opacity: isCollapsed ? 0 : 1,
          transform: isCollapsed ? "translateY(-8px)" : "translateY(0)",
          overflow: isCollapsed ? "hidden" : "visible",
          transition: "max-height 320ms ease, opacity 220ms ease, transform 260ms ease",
        }}
      >
        <div
          className={`overflow-hidden space-y-2 ${
            depth === 1
              ? "ml-5 pl-4 border-l-2 border-amber-300 bg-amber-50/50 rounded-r-xl py-2"
              : "ml-4 pl-4 border-l border-amber-200"
          }`}
          onDragOver={(event) => {
            if (!draggedChild || draggedChild.parentId !== parentId || isBusy) return;
            if (event.target !== event.currentTarget) return;
            event.preventDefault();
            setDragOverSlot({ parentId, index: followups.length });
          }}
          onDrop={(event) => {
            if (!draggedChild || draggedChild.parentId !== parentId || isBusy) return;
            if (event.target !== event.currentTarget) return;
            event.preventDefault();
            event.stopPropagation();
            const currentIds = followups.map((child) => child.id);
            const nextIds = reorderIds(currentIds, draggedChild.childId, followups.length);
            void onReorderChildren(parentId, nextIds);
          }}
        >
          {followups.map((child, index) => {
            const beforeActive = isActiveDragParent && dragOverSlot?.parentId === parentId && dragOverSlot.index === index;
            const afterActive =
              isActiveDragParent && dragOverSlot?.parentId === parentId && dragOverSlot.index === index + 1;
            const isDraggingThis = draggedChild?.childId === child.id;

            return (
              <div key={child.id} className="space-y-2">
                <div
                  className={`h-2 rounded transition-colors ${beforeActive ? "bg-amber-300/80" : "bg-transparent"}`}
                  onDragOver={(event) => {
                    if (!draggedChild || draggedChild.parentId !== parentId || isBusy) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDragOverSlot({ parentId, index });
                  }}
                  onDrop={(event) => {
                    if (!draggedChild || draggedChild.parentId !== parentId || isBusy) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const currentIds = followups.map((item) => item.id);
                    const nextIds = reorderIds(currentIds, draggedChild.childId, index);
                    void onReorderChildren(parentId, nextIds);
                  }}
                />
                <div
                  draggable={!isBusy}
                  onDragStart={() => setDraggedChild({ childId: child.id, parentId })}
                  onDragEnd={() => clearDragState()}
                  onDragOver={(event) => {
                    if (!draggedChild || isBusy) return;
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onDrop={(event) => {
                    if (!draggedChild || isBusy) return;
                    event.preventDefault();
                    event.stopPropagation();
                    void onMoveChildIntoQuestion(draggedChild.childId, child.id);
                  }}
                  className={`${isDraggingThis ? "opacity-60" : ""}`}
                >
                  {renderQuestionCard(child, true)}
                </div>
                <div
                  className={`h-2 rounded transition-colors ${afterActive ? "bg-amber-300/80" : "bg-transparent"}`}
                  onDragOver={(event) => {
                    if (!draggedChild || draggedChild.parentId !== parentId || isBusy) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDragOverSlot({ parentId, index: index + 1 });
                  }}
                  onDrop={(event) => {
                    if (!draggedChild || draggedChild.parentId !== parentId || isBusy) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const currentIds = followups.map((item) => item.id);
                    const nextIds = reorderIds(currentIds, draggedChild.childId, index + 1);
                    void onReorderChildren(parentId, nextIds);
                  }}
                />
                {!nextSeen.has(child.id) && renderFollowups(child.id, depth + 1, nextSeen)}
              </div>
            );
          })}
          {isBusy && (
            <p className="text-[11px] text-amber-700 px-1">Saving order...</p>
          )}
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
            <button
              onClick={onExportAll}
              className={buttonSecondary}
              title="Export all visible questions and answers to Word (.docx)"
              disabled={exportingAll}
            >
              <DownloadIcon className="w-4 h-4 mr-1.5" />
              {exportingAll ? "Exporting..." : "Export"}
            </button>
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
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="min-w-[180px] border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/40 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <select
              value={tagsFilter}
              onChange={(e) => setTagsFilter(e.target.value)}
              className="min-w-[220px] border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/40 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">All tags</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <button
              onClick={() => refresh({ search, source: sourceFilter, tags: tagsFilter })}
              className={buttonSecondary}
            >
              Search
            </button>
            <button
              onClick={() => {
                setSearch("");
                setSourceFilter("");
                setTagsFilter("");
                void refresh({ search: "", source: "", tags: "" });
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
                  onClick={() => setCollapsedThreadIds(new Set(childrenByParentId.keys()))}
                  className={buttonSecondary}
                >
                  Collapse all threads
                </button>
                <button
                  onClick={() => {
                    setCollapsedThreadIds(new Set());
                  }}
                  className={buttonSecondary}
                >
                  Expand all threads
                </button>
              </>
            )}
            {focusedThreadId && (
              <button
                onClick={() => setFocusedThreadId(null)}
                className={`${buttonBase} border bg-amber-700 text-amber-50 border-amber-700`}
                title="Return to all threads"
              >
                Exit focus mode
              </button>
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

          {!loading && focusedThreadId && displayedRoots.length > 0 && (
            <div className="text-xs text-amber-900 bg-amber-100/80 border border-amber-300 rounded-xl p-3">
              Focus mode is on: showing one thread and all of its follow-ups.
            </div>
          )}

          {draggedChild && (
            <div
              className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-100/60 p-3 text-sm text-amber-900"
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void onMoveChildToTopLevel(draggedChild.childId);
              }}
            >
              Drop here to move this follow-up question out of parent (make top-level).
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

          {!loading && !topLevelOnly && !focusedThreadId && orphanFollowups.length > 0 && (
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
                    {form.source.trim() && sourceSuggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sourceSuggestions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              setForm((p) => ({ ...p, source: item }));
                              setSourceSuggestions([]);
                            }}
                            className="text-xs px-2 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
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
                  {activeTagToken && tagSuggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => applyTagSuggestion(tag)}
                          className="text-xs px-2 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
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
        {studiedDialogThreadId && (
          <div className="fixed inset-0 bg-stone-900/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-amber-200 shadow-xl p-4 animate-[fadeIn_180ms_ease-out]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Set Studied Date &amp; Time</h3>
                <button
                  onClick={() => {
                    setStudiedDialogThreadId(null);
                    setStudiedDialogValue("");
                  }}
                  className={buttonSecondary}
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-stone-700">Studied at (IST)</label>
                  <input
                    type="datetime-local"
                    value={studiedDialogValue}
                    onChange={(e) => setStudiedDialogValue(e.target.value)}
                    className="mt-1 w-full border border-amber-300 rounded-lg px-3 py-2 bg-amber-50/30"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setStudiedDialogThreadId(null);
                      setStudiedDialogValue("");
                    }}
                    className={buttonSecondary}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void onSaveStudiedDateTime()}
                    disabled={!studiedDialogValue || markingStudiedThreadId === studiedDialogThreadId}
                    className={`${buttonPrimary} disabled:opacity-50`}
                  >
                    {markingStudiedThreadId === studiedDialogThreadId ? "Saving..." : "Save studied time"}
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
