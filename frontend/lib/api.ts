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

export async function listQuestions(): Promise<Question[]> {
  const res = await fetch(`${API_BASE}/v1/questions`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch questions: ${res.status}`);
  }

  return res.json();
}
