import { NavLink, Outlet, useNavigate } from "react-router-dom";

const navItems = [
  { to: "/student", label: "Dashboard", end: true },
  { to: "/student/tests", label: "My Tests" },
  { to: "/student/results", label: "My Results" },
  { to: "/student/profile", label: "Profile" },
];

export default function StudentLayout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="border-b border-slate-200 px-7 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Test Management
            </p>
            <h1 className="mt-2 text-xl font-bold">Student Portal</h1>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <button
              onClick={logout}
              className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-5 py-4 md:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                  Test Management
                </p>
                <p className="font-bold">Student Portal</p>
              </div>
              <button
                onClick={logout}
                className="text-sm font-semibold text-slate-500"
              >
                Log out
              </button>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </header>

          <main className="flex-1 p-5 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
