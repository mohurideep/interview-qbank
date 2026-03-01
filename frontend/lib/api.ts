export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// --------------------
// Types
// --------------------
export type Question = {
  id: string;
  parent_id: string | null;
  child_order: number;
  studied_at: string | null;
  studied_count: number;
  studied_history: string[];
  question_text: string;
  answer_md: string;
  difficulty: number;
  source: string;
  is_flagged: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;

  review_count: number;
  mastery_score: number;
  next_review_at: string;
};

export type QuestionCreate = {
  parent_id?: string | null;
  question_text: string;
  answer_md: string;
  difficulty: number;
  source: string;
  tags: string[];
};

// ✅ PATCH supports partial fields
export type QuestionUpdate = Partial<QuestionCreate> & {
  is_flagged?: boolean;
  studied_at?: string | null;
};

export type Me = {
  id: string;
  email: string;
};

// --------------------
// Shared fetch helper (cookie auth)
// --------------------
async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  // Only set JSON content-type when body exists
  if (init.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // ✅ REQUIRED for HttpOnly cookie auth
    cache: "no-store",
  });

  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await res.json().catch(() => null);
      const msg = j?.detail || j?.message || JSON.stringify(j);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  // Handle endpoints that may return empty body
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null as T;
  return (await res.json()) as T;
}

async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await res.json().catch(() => null);
      const msg = j?.detail || j?.message || JSON.stringify(j);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.blob();
}

// --------------------
// Auth APIs (cookie based)
// --------------------
export async function register(email: string, password: string) {
  return apiFetch<Me>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  return apiFetch<Me>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return apiFetch<{ status: string }>("/v1/auth/logout", {
    method: "POST",
  });
}

export async function me() {
  return apiFetch<Me>("/v1/auth/me", {
    method: "GET",
  });
}

export async function refresh() {
  return apiFetch<{ status: string }>("/v1/auth/refresh_v2", {
    method: "POST",
  });
}

// --------------------
// Questions APIs
// --------------------
export async function listQuestions(params?: {
  search?: string;
  source?: string;
  tags?: string;
  due_only?: boolean;
}) {
  const usp = new URLSearchParams();
  if (params?.search) usp.set("search", params.search);
  if (params?.source) usp.set("source", params.source);
  if (params?.tags) usp.set("tags", params.tags);
  if (params?.due_only !== undefined) usp.set("due_only", String(params.due_only));

  const qs = usp.toString();
  const path = qs ? `/v1/questions?${qs}` : "/v1/questions";

  return apiFetch<Question[]>(path, { method: "GET" });
}

export async function getQuestionSuggestions(
  field: "source" | "tag",
  q: string,
  limit = 8
) {
  const usp = new URLSearchParams({
    field,
    q,
    limit: String(limit),
  });
  return apiFetch<string[]>(`/v1/questions/suggestions?${usp.toString()}`, { method: "GET" });
}

export async function createQuestion(payload: QuestionCreate) {
  return apiFetch<Question>("/v1/questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ✅ NEW: Update
export async function updateQuestion(id: string, payload: QuestionUpdate) {
  return apiFetch<Question>(`/v1/questions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ✅ NEW: Delete
export async function deleteQuestion(id: string) {
  return apiFetch<{ status: string }>(`/v1/questions/${id}`, {
    method: "DELETE",
  });
}

export async function reviewQuestion(id: string, rating: "forgot" | "almost" | "knew") {
  const usp = new URLSearchParams({ rating });
  return apiFetch<{ status: string; next_review_at: string; mastery_score: number }>(
    `/v1/questions/${id}/review?${usp.toString()}`,
    { method: "POST" }
  );
}

export async function reorderChildren(parent_id: string, ordered_child_ids: string[]) {
  return apiFetch<{ status: string }>("/v1/questions/reorder-children", {
    method: "POST",
    body: JSON.stringify({ parent_id, ordered_child_ids }),
  });
}

export async function exportQuestionsDocx(params?: {
  thread_id?: string;
  search?: string;
  source?: string;
  tags?: string;
  due_only?: boolean;
}) {
  const usp = new URLSearchParams();
  if (params?.thread_id) usp.set("thread_id", params.thread_id);
  if (params?.search) usp.set("search", params.search);
  if (params?.source) usp.set("source", params.source);
  if (params?.tags) usp.set("tags", params.tags);
  if (params?.due_only !== undefined) usp.set("due_only", String(params.due_only));

  const qs = usp.toString();
  const path = qs ? `/v1/questions/export?${qs}` : "/v1/questions/export";
  return apiFetchBlob(path, { method: "GET" });
}

// --------------------
// Dashboard APIs
// --------------------
export type WeakTag = {
  name: string;
  avg_mastery: number;
  question_count: number;
};

export type DashboardStats = {
  total_questions: number;
  due_now: number;
  avg_mastery: number;
  total_reviews: number;
  weakest_tags: WeakTag[];
};

export async function getDashboardStats() {
  return apiFetch<DashboardStats>("/v1/dashboard/stats", { method: "GET" });
}
