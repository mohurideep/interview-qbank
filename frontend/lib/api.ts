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
};

export type QuestionCreate = {
  question_text: string;
  answer_md: string;
  difficulty: number;
  source: string;
  tags: string[];
};

export async function listQuestions(params?: { search?: string }) {
  const usp = new URLSearchParams();
  if (params?.search) usp.set("search", params.search);

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
