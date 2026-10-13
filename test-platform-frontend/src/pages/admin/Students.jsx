import { useState, useEffect } from "react";
import api from "../../api";

export default function Students() {
  const [name, setName] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newCredentials, setNewCredentials] = useState(null); // shown once after creating

  async function loadStudents() {
    try {
      const response = await api.get("/admin/students");
      setStudents(response.data);
    } catch (err) {
      setError("Could not load the student list.");
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    setNewCredentials(null);

    try {
      const response = await api.post("/admin/students", { name });
      setNewCredentials(response.data);
      setName("");
      loadStudents(); // refresh the list to include the new student
    } catch (err) {
      setError("Could not create the student. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1E293B] mb-1">Students</h1>
      <p className="text-sm text-[#64748B] mb-6">
        Create student accounts. A username and temporary password are generated automatically.
      </p>

      {/* Create student form */}
      <form onSubmit={handleCreate} className="bg-white border border-[#E2E0D9] rounded-lg p-6 mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label htmlFor="studentName" className="block text-sm font-medium text-[#1E293B] mb-1">
            Student name
          </label>
          <input
            id="studentName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            required
            className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 text-[#1E293B]
                       focus:outline-none focus:ring-2 focus:ring-[#3730A3] focus:border-[#3730A3]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-[#3730A3] text-white text-sm font-medium rounded-md px-4 py-2
                     hover:bg-[#312E81] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? "Creating..." : "Add student"}
        </button>
      </form>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] text-sm rounded-md p-3 mb-6">
          {error}
        </div>
      )}

      {/* Show the generated credentials ONCE, right after creation */}
      {newCredentials && (
        <div className="bg-[#EFF6FF] border border-[#93C5FD] rounded-md p-4 mb-6">
          <p className="text-sm font-medium text-[#1E293B] mb-2">
            Account created for {newCredentials.name} — note these down now, the password won't be shown again:
          </p>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-[#64748B]">Username: </span>
              <span className="font-mono font-medium text-[#1E293B]">{newCredentials.username}</span>
            </div>
            <div>
              <span className="text-[#64748B]">Temporary password: </span>
              <span className="font-mono font-medium text-[#1E293B]">{newCredentials.temporary_password}</span>
            </div>
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="bg-white border border-[#E2E0D9] rounded-lg p-6">
        <h2 className="text-sm font-medium text-[#1E293B] mb-3">
          All students ({students.length})
        </h2>
        {students.length === 0 ? (
          <p className="text-sm text-[#64748B]">No students yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#64748B] border-b border-[#E2E0D9]">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Username</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.user_id} className="border-b border-[#F1F0EC]">
                  <td className="py-2 pr-3 text-[#1E293B]">{s.name}</td>
                  <td className="py-2 pr-3 font-mono text-[#1E293B]">{s.username}</td>
                  <td className="py-2 pr-3">
                    {s.must_change_password ? (
                      <span className="text-[#B45309]">Password not yet set</span>
                    ) : (
                      <span className="text-[#15803D]">Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
