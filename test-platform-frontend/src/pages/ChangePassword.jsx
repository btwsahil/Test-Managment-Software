import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // NOTE: backend endpoint for this doesn't exist yet - we'll build
      // POST /change-password next. This screen is ready and waiting for it.
      await api.post("/change-password", { new_password: newPassword });

      const role = localStorage.getItem("role");
      navigate(role === "admin" ? "/admin" : "/student");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[#1E293B] mb-1">Set a new password</h1>
        <p className="text-sm text-[#64748B] mb-6">
          You're using a temporary password. Choose a new one to continue.
        </p>

        <form onSubmit={handleSubmit} className="bg-white border border-[#E2E0D9] rounded-lg p-6 space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-[#1E293B] mb-1">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
              className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 text-[#1E293B]
                         focus:outline-none focus:ring-2 focus:ring-[#3730A3] focus:border-[#3730A3]"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#1E293B] mb-1">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 text-[#1E293B]
                         focus:outline-none focus:ring-2 focus:ring-[#3730A3] focus:border-[#3730A3]"
            />
          </div>

          {error && (
            <p className="text-sm text-[#B91C1C]" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3730A3] text-white font-medium rounded-md py-2
                       hover:bg-[#312E81] disabled:opacity-60 transition-colors"
          >
            {loading ? "Saving..." : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
