import { useEffect, useState } from "react";
import api from "../../api";

export default function MyResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/student/results")
      .then((response) => setResults(response.data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Could not load your results.")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading results...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-semibold text-indigo-600">Student Portal</p>
        <h1 className="mt-2 text-3xl font-bold">My Results</h1>
        <p className="mt-2 text-slate-500">
          Review your completed tests and topics that need more practice.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h3 className="font-bold">No results yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Complete your first test and the result will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.3fr_1fr_0.7fr_0.7fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
            <span>Subject</span>
            <span>Topic</span>
            <span>Correct</span>
            <span>Wrong</span>
            <span>Score</span>
          </div>

          <div className="divide-y divide-slate-100">
            {results.map((result) => (
              <div
                key={result.result_id}
                className="grid gap-3 px-6 py-5 md:grid-cols-[1.3fr_1fr_0.7fr_0.7fr_0.8fr] md:items-center md:gap-4"
              >
                <div>
                  <p className="font-semibold">{result.subject_name}</p>
                  <p className="text-xs text-slate-400 md:hidden">
                    {result.topic_name || "Mixed topics"}
                  </p>
                </div>
                <span className="hidden text-sm text-slate-500 md:block">
                  {result.topic_name || "Mixed topics"}
                </span>
                <span className="text-sm text-emerald-700">
                  {result.correct_answers}
                </span>
                <span className="text-sm text-red-600">{result.wrong_answers}</span>
                <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">
                  {Number(result.score_percent).toFixed(0)}%
                </span>

                {result.weak_topics?.length > 0 && (
                  <div className="md:col-span-5">
                    <p className="text-xs font-semibold text-slate-400">Review:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.weak_topics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
