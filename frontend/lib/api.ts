export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// --------------------
// Types
// --------------------
export type Question = {
  id: string;
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
  question_text: string;
  answer_md: string;
  difficulty: number;
  source: string;
  tags: string[];
};

export type Me = {
  id: string;
  email: string;
};

// --------------------
// Shared fetch helper (cookie auth)
// --------------------
async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    credentials: "include", // ✅ IMPORTANT: send/receive HttpOnly cookies
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  // Handle endpoints that may return empty body
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null as T;
  return (await res.json()) as T;
}

// --------------------
// Auth APIs
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
  // Your backend endpoint is /v1/auth/refresh_v2 (cookie-based)
  return apiFetch<{ status: string }>("/v1/auth/refresh_v2", {
    method: "POST",
  });
}

// --------------------
// Questions APIs
// --------------------
export async function listQuestions(params?: { search?: string; due_only?: boolean }) {
  const usp = new URLSearchParams();
  if (params?.search) usp.set("search", params.search);
  if (params?.due_only !== undefined) usp.set("due_only", String(params.due_only));

  const qs = usp.toString();
  const path = qs ? `/v1/questions?${qs}` : "/v1/questions";

  return apiFetch<Question[]>(path, { method: "GET" });
}

export async function createQuestion(payload: QuestionCreate) {
  return apiFetch<Question>("/v1/questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reviewQuestion(id: string, rating: "forgot" | "almost" | "knew") {
  const usp = new URLSearchParams({ rating });
  return apiFetch<{ status: string; next_review_at: string; mastery_score: number }>(
    `/v1/questions/${id}/review?${usp.toString()}`,
    { method: "POST" }
  );
}

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
