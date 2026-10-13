import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

export default function MyTests() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/student/assignments");
      setAssignments(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load your tests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading tests...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-semibold text-indigo-600">Student Portal</p>
        <h2 className="mt-2 text-3xl font-bold">My Tests</h2>
        <p className="mt-2 text-slate-500">
          Open an assigned test or resume one that is already in progress.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h3 className="font-bold">No tests assigned</h3>
          <p className="mt-2 text-sm text-slate-500">
            Your teacher will assign tests here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const completed = assignment.status === "completed";
            const ongoing = assignment.status === "ongoing";

            return (
              <div
                key={assignment.assignment_id}
                className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      completed
                        ? "bg-slate-100 text-slate-600"
                        : ongoing
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {completed ? "Completed" : ongoing ? "In progress" : "Available"}
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{assignment.subject_name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {assignment.topic_name || "Mixed topics"}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">
                    {assignment.num_questions} questions · {assignment.time_limit_minutes} minutes
                  </p>
                </div>

                {!completed && (
                  <Link
                    to={`/student/tests/${assignment.assignment_id}`}
                    className="rounded-xl bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    {ongoing ? "Resume Test" : "View Test"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
