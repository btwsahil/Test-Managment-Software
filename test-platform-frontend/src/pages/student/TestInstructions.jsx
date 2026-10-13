import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";

export default function TestInstructions() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await api.get("/student/assignments");
        const found = response.data.find(
          (item) => String(item.assignment_id) === String(testId)
        );
        if (!found) {
          setError("This test could not be found in your assignments.");
        } else {
          setAssignment(found);
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load this test.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [testId]);

  async function start() {
    setStarting(true);
    setError("");
    try {
      await api.post(`/student/assignments/${testId}/start`);
      navigate(`/student/tests/${testId}/attempt`);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not start the test.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading test...</div>;
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorPanel message={error || "Test not found."} />
        <Link to="/student/tests" className="mt-4 inline-block text-sm font-semibold text-indigo-600">
          ← Back to My Tests
        </Link>
      </div>
    );
  }

  const completed = assignment.status === "completed";
  const ongoing = assignment.status === "ongoing";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/student/tests" className="text-sm font-semibold text-indigo-600">
        ← Back to My Tests
      </Link>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-10">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          {assignment.topic_name || "Mixed topics"}
        </span>

        <h1 className="mt-5 text-3xl font-bold">{assignment.subject_name}</h1>
        <p className="mt-2 text-slate-500">Test instructions</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Info label="Questions" value={assignment.num_questions} />
          <Info label="Time limit" value={`${assignment.time_limit_minutes} minutes`} />
          <Info label="Status" value={assignment.status} />
          <Info label="Scoring" value="Auto-evaluated" />
        </div>

        <div className="mt-8 rounded-2xl bg-slate-50 p-5">
          <h2 className="font-bold">Before you start</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <li>• Make sure you have a stable internet connection.</li>
            <li>• Each selected answer is saved automatically.</li>
            <li>• Questions and options may appear in a random order.</li>
            <li>• Do not close the test until you submit it.</li>
            <li>• The test will be submitted automatically when the timer reaches zero.</li>
          </ul>
        </div>

        {error && <ErrorPanel message={error} />}

        {!completed && (
          <button
            onClick={start}
            disabled={starting}
            className="mt-8 w-full rounded-xl bg-indigo-600 px-5 py-4 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? "Starting..." : ongoing ? "Resume Test" : "Start Test"}
          </button>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-semibold capitalize">{value}</p>
    </div>
  );
}

function ErrorPanel({ message }) {
  return (
    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message}
    </div>
  );
}
