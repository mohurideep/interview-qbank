export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

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

export async function listQuestions(params?: { search?: string; due_only?: boolean }) {
  const usp = new URLSearchParams();
  if (params?.search) usp.set("search", params.search);
  if (params?.due_only !== undefined) usp.set("due_only", String(params.due_only));

  const res = await fetch(`${API_BASE}/v1/questions?${usp.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Failed to fetch questions: ${res.status}`);
  return (await res.json()) as Question[];
}

export async function createQuestion(payload: QuestionCreate) {
  const res = await fetch(`${API_BASE}/v1/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Failed to create question: ${res.status}`);
  return (await res.json()) as Question;
}

export async function reviewQuestion(
  id: string,
  rating: "forgot" | "almost" | "knew"
) {
  const res = await fetch(`${API_BASE}/v1/questions/${id}/review?rating=${rating}`, {
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Review failed (${res.status}): ${text}`);
  }

  return res.json();
}
