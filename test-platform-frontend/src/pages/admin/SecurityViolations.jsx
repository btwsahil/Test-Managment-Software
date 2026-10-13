import { useEffect, useMemo, useState } from "react";
import api from "../../api";

const typeLabels = {
  TAB_SWITCH: "Tab switch",
  WINDOW_BLUR: "Window switch",
  FULLSCREEN_EXIT: "Fullscreen exit",
  RESTRICTED_SHORTCUT: "Restricted shortcut",
};

export default function SecurityViolations() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadViolations() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/security/violations");
      setViolations(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load security violations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadViolations();
  }, []);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return violations;
    return violations.filter((item) =>
      [
        item.student_name,
        item.subject_name,
        item.topic_name,
        item.violation_type,
        item.message,
        String(item.session_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [violations, search]);

  const uniqueStudents = new Set(violations.map((item) => item.student_id)).size;
  const uniqueSessions = new Set(violations.map((item) => item.session_id)).size;

  const typeCounts = violations.reduce((acc, item) => {
    acc[item.violation_type] = (acc[item.violation_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 text-[#1E293B]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Exam security</p>
          <h1 className="mt-1 text-3xl font-bold">Security Violations</h1>
          <p className="mt-2 text-sm text-slate-500">Server-side audit trail of security events detected during tests.</p>
        </div>
        <button
          onClick={loadViolations}
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total violations" value={violations.length} />
        <StatCard label="Students involved" value={uniqueStudents} />
        <StatCard label="Test sessions" value={uniqueSessions} />
      </div>

      {violations.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {typeLabels[type] || type}
              </p>
              <p className="mt-1 text-2xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold">Violation log</h2>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student, subject, session..."
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-500 sm:w-80"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading security log...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-10 text-center text-sm text-slate-500">
            {violations.length === 0 ? "No security violations have been recorded." : "No matching violations found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Test</th>
                  <th className="px-3 py-3">Session</th>
                  <th className="px-3 py-3">Violation</th>
                  <th className="px-3 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.violation_id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-4 text-slate-500">
                      {formatDate(item.occurred_at)}
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold">{item.student_name}</p>
                      <p className="text-xs text-slate-400">ID: {item.student_id}</p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-medium">{item.subject_name}</p>
                      {item.topic_name && <p className="text-xs text-slate-400">{item.topic_name}</p>}
                    </td>
                    <td className="px-3 py-4 text-slate-500">
                      #{item.session_id}
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                        {typeLabels[item.violation_type] || item.violation_type}
                      </span>
                    </td>
                    <td className="max-w-sm px-3 py-4 text-slate-600">
                      {item.message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}
