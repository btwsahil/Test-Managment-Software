import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

function StatCard({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

export default function StudentDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [assignmentRes, resultRes] = await Promise.all([
        api.get("/student/assignments"),
        api.get("/student/results"),
      ]);
      setAssignments(assignmentRes.data);
      setResults(resultRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const available = useMemo(
    () => assignments.filter((a) => a.status !== "completed"),
    [assignments]
  );

  const average = results.length
    ? Math.round(
        results.reduce((sum, result) => sum + Number(result.score_percent), 0) /
          results.length
      )
    : 0;

  if (loading) {
    return <Loading text="Loading your dashboard..." />;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <p className="text-sm font-semibold text-indigo-600">Student Dashboard</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">
          Welcome back, Student 👋
        </h2>
        <p className="mt-2 text-slate-500">
          Check your assigned tests and keep track of your progress.
        </p>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          label="Available Tests"
          value={available.length}
          note="Ready to attempt"
        />
        <StatCard
          label="Completed Tests"
          value={results.length}
          note="Tests submitted"
        />
        <StatCard
          label="Average Score"
          value={`${average}%`}
          note="Across completed tests"
        />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className="text-xl font-bold">Assigned Tests</h3>
            <p className="text-sm text-slate-500">Tests currently available to you.</p>
          </div>
          <Link
            to="/student/tests"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View all
          </Link>
        </div>

        {assignments.length === 0 ? (
          <EmptyState
            title="No tests assigned yet"
            text="Your teacher has not assigned a test to you."
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {assignments.slice(0, 4).map((assignment) => (
              <AssignmentCard key={assignment.assignment_id} assignment={assignment} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AssignmentCard({ assignment }) {
  const completed = assignment.status === "completed";
  const ongoing = assignment.status === "ongoing";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
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
      </div>

      <h4 className="mt-5 text-lg font-bold">{assignment.subject_name}</h4>
      <p className="mt-1 text-sm text-slate-500">
        {assignment.topic_name || "Mixed topics"}
      </p>

      <div className="mt-5 flex gap-6 text-sm text-slate-600">
        <span>{assignment.num_questions} questions</span>
        <span>{assignment.time_limit_minutes} min</span>
      </div>

      {!completed && (
        <Link
          to={`/student/tests/${assignment.assignment_id}`}
          className="mt-6 block rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          {ongoing ? "Resume Test" : "View Test"}
        </Link>
      )}
    </div>
  );
}

function Loading({ text }) {
  return <div className="py-20 text-center text-slate-500">{text}</div>;
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h4 className="font-bold">{title}</h4>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function ErrorBox({ message, onRetry }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <span>{message}</span>
      <button onClick={onRetry} className="font-semibold underline">
        Retry
      </button>
    </div>
  );
}
