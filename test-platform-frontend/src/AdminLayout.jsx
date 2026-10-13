import { NavLink, Outlet, useNavigate } from "react-router-dom";

const navItems = [
  { to: "/admin/questions", label: "Question Bank" },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/assignments", label: "Assign Tests" },
  { to: "/admin/results", label: "Results" },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-[#E2E0D9] flex flex-col">
        <div className="px-5 py-5 border-b border-[#E2E0D9]">
          <h2 className="text-lg font-semibold text-[#1E293B]">Admin</h2>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#3730A3] text-white"
                    : "text-[#1E293B] hover:bg-[#F1F0EC]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-[#E2E0D9]">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-[#64748B] hover:bg-[#F1F0EC] transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main content - each admin page renders here via nested routes */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
