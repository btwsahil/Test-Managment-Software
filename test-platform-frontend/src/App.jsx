import Results from "./pages/admin/Results";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import AdminLayout from "./components/AdminLayout";
import QuestionBank from "./pages/admin/QuestionBank";
import Students from "./pages/admin/Students";
import Assignments from "./pages/admin/Assignments";
import SecurityViolations from "./pages/admin/SecurityViolations";

import StudentLayout from "./components/student/StudentLayout";
import StudentDashboard from "./pages/student/StudentDashboard";
import MyTests from "./pages/student/MyTests";
import TestInstructions from "./pages/student/TestInstructions";
import TakeTest from "./pages/student/TakeTest";
import MyResults from "./pages/student/MyResults";
import StudentProfile from "./pages/student/StudentProfile";

function ProtectedRoute({ children, allowedRole }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/questions" replace />} />
          <Route path="questions" element={<QuestionBank />} />
          <Route path="students" element={<Students />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="results" element={<Results />} />
          <Route path="security" element={<SecurityViolations />} />
        </Route>

        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="tests" element={<MyTests />} />
          <Route path="tests/:testId" element={<TestInstructions />} />
          <Route path="tests/:testId/attempt" element={<TakeTest />} />
          <Route path="results" element={<MyResults />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
