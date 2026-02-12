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

export type LoginResp = {
  access_token: string;
  token_type: string; // "bearer"
  email?: string;     // optional if your backend returns it
};

// --------------------
// Token helpers
// --------------------
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function setToken(token: string) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("email");
}

// --------------------
// Shared fetch helper (Bearer auth)
// --------------------
async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  // Only set JSON content-type when body exists
  if (init.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    // Try to extract useful error message
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

// --------------------
// Auth APIs (token based)
// --------------------
export async function register(email: string, password: string) {
  // backend: POST /v1/auth/register
  // expected response can be Me or something similar
  return apiFetch<Me>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  // backend: POST /v1/auth/login -> returns { access_token, token_type }
  const data = await apiFetch<LoginResp>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!data?.access_token) {
    throw new Error("Login response missing access_token");
  }

  setToken(data.access_token);
  localStorage.setItem("email", data.email ?? email);

  return data;
}

export async function logout() {
  // If your backend has logout endpoint, call it (optional)
  // But always clear local token.
  try {
    await apiFetch<{ status: string }>("/v1/auth/logout", { method: "POST" });
  } catch {
    // ignore (backend logout may not exist / may require cookie)
  } finally {
    clearToken();
  }
  return { status: "ok" as const };
}

export async function me() {
  // backend: GET /v1/auth/me (must accept Authorization: Bearer)
  return apiFetch<Me>("/v1/auth/me", { method: "GET" });
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
