import { listQuestions } from "@/lib/api";

export default async function Home() {
  const questions = await listQuestions();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Interview QBank</h1>
          <span className="text-sm text-gray-600">
            {questions.length} questions
          </span>
        </header>

        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-semibold">{q.question_text}</h2>
                <span className="text-xs px-2 py-1 rounded bg-gray-100">
                  L{q.difficulty}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {q.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-gray-200 px-2 py-1 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {q.source && (
                <p className="mt-2 text-xs text-gray-500">
                  Source: {q.source}
                </p>
              )}
            </div>
          ))}

          {questions.length === 0 && (
            <div className="text-gray-600 bg-white border rounded-lg p-6">
              No questions yet. Add one from Swagger first, then refresh.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
