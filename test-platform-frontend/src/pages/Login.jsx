import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "student",
    adminKey: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function updateLogin(field, value) {
    setLoginForm((previous) => ({ ...previous, [field]: value }));
  }

  function updateRegister(field, value) {
    setRegisterForm((previous) => ({ ...previous, [field]: value }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await api.post("/login", loginForm);
      const { access_token, role, must_change_password } = response.data;

      localStorage.setItem("token", access_token);
      localStorage.setItem("role", role);

      if (must_change_password) {
        navigate("/change-password");
      } else if (role === "admin") {
        navigate("/admin");
      } else {
        navigate("/student");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (registerForm.password !== registerForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (registerForm.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (registerForm.role === "admin" && !registerForm.adminKey.trim()) {
      setError("Admin registration key is required.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/register", {
        name: registerForm.name,
        username: registerForm.username,
        password: registerForm.password,
        role: registerForm.role,
        admin_key: registerForm.role === "admin" ? registerForm.adminKey : null,
      });

      setSuccess(
        `${response.data.role === "admin" ? "Admin" : "Student"} account created successfully. You can now sign in.`
      );
      setLoginForm({ username: response.data.username, password: "" });
      setRegisterForm({
        name: "",
        username: "",
        password: "",
        confirmPassword: "",
        role: "student",
        adminKey: "",
      });
      setMode("login");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1E293B]">Test Management System</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {mode === "login" ? "Sign in to continue." : "Create your account."}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-lg border border-[#E2E0D9] bg-white p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              mode === "login" ? "bg-[#3730A3] text-white" : "text-[#64748B] hover:bg-[#F1F0EC]"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              mode === "register" ? "bg-[#3730A3] text-white" : "text-[#64748B] hover:bg-[#F1F0EC]"
            }`}
          >
            Create account
          </button>
        </div>

        <div className="bg-white border border-[#E2E0D9] rounded-lg p-6">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-[#1E293B] mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => updateLogin("username", e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#3730A3]"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#1E293B] mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => updateLogin("password", e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#3730A3]"
                />
              </div>

              {error && <p className="text-sm text-[#B91C1C]" role="alert">{error}</p>}
              {success && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#3730A3] text-white font-medium rounded-md py-2 hover:bg-[#312E81] disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">Full name</label>
                <input
                  type="text"
                  value={registerForm.name}
                  onChange={(e) => updateRegister("name", e.target.value)}
                  required
                  autoFocus
                  autoComplete="name"
                  placeholder="e.g. Rahul Sharma"
                  className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3730A3]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">Username</label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => updateRegister("username", e.target.value)}
                  required
                  minLength={3}
                  autoComplete="username"
                  placeholder="Choose a username"
                  className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3730A3]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">Account type</label>
                <select
                  value={registerForm.role}
                  onChange={(e) => updateRegister("role", e.target.value)}
                  className="w-full border border-[#D6D3C9] rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3730A3]"
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {registerForm.role === "admin" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="block text-sm font-medium text-amber-900 mb-1">Admin registration key</label>
                  <input
                    type="password"
                    value={registerForm.adminKey}
                    onChange={(e) => updateRegister("adminKey", e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="Enter the key provided by the system owner"
                    className="w-full border border-amber-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="mt-1 text-xs text-amber-800">Admin accounts cannot be created without this server-side key.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">Password</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => updateRegister("password", e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3730A3]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">Confirm password</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => updateRegister("confirmPassword", e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  className="w-full border border-[#D6D3C9] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3730A3]"
                />
              </div>

              {error && <p className="text-sm text-[#B91C1C]" role="alert">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#3730A3] text-white font-medium rounded-md py-2 hover:bg-[#312E81] disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
