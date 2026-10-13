import { useEffect, useState } from "react";
import api from "../../api";

export default function StudentProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/student/profile")
      .then((response) => setProfile(response.data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Could not load your profile.")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading profile...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-indigo-600">Student Portal</p>
      <h1 className="mt-2 text-3xl font-bold">Profile</h1>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-5 border-b border-slate-200 pb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
            {profile?.name?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile?.name}</h2>
            <p className="text-sm text-slate-500">Student account</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Name" value={profile?.name} />
          <Field label="Username" value={profile?.username} />
          <Field label="Role" value={profile?.role} />
          <Field label="User ID" value={profile?.user_id} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-semibold">{value ?? "—"}</p>
    </div>
  );
}
