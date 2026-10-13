import { useEffect, useMemo, useState } from "react";
import api from "../../api";

const semesters = Array.from({ length: 8 }, (_, i) => i + 1);

export default function Assignments() {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [semester, setSemester] = useState("");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimit, setTimeLimit] = useState("");
  const [easy, setEasy] = useState(0);
  const [medium, setMedium] = useState(0);
  const [hard, setHard] = useState(0);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/admin/students"),
      api.get("/admin/subjects"),
    ])
      .then(([studentResponse, subjectResponse]) => {
        setStudents(studentResponse.data);
        setSubjects(subjectResponse.data);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || "Could not load students or subjects.");
      })
      .finally(() => setLoading(false));
  }, []);

  const semesterStudents = useMemo(
    () =>
      students.filter(
        (s) => semester && Number(s.semester) === Number(semester)
      ),
    [students, semester]
  );

  const selectedSubject = subjects.find(
    (s) => Number(s.subject_id) === Number(subjectId)
  );

  const availableTopics = selectedSubject?.topics || [];
  const difficultyTotal = Number(easy) + Number(medium) + Number(hard);
  const mixedDifficulty = difficultyTotal === 0;

  function changeSemester(value) {
    setSemester(value);
    setSelectedStudents([]);
    setMessage("");
    setError("");
  }

  function toggleStudent(id) {
    setSelectedStudents((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= 85) {
        setError("Maximum 85 students can be assigned at one time.");
        return current;
      }
      return [...current, id];
    });
  }

  function selectAllSemester() {
    const ids = semesterStudents.slice(0, 85).map((s) => s.user_id);
    setSelectedStudents(ids);
    setError(
      semesterStudents.length > 85
        ? "This semester has more than 85 students. The first 85 are selected."
        : ""
    );
  }

  function clearStudents() {
    setSelectedStudents([]);
  }

  function updateDifficulty(setter, value) {
    setter(Math.max(0, Number(value) || 0));
    setError("");
  }

  async function assignTest(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!semester) return setError("Select a semester first.");
    if (selectedStudents.length === 0) return setError("Select at least one student.");
    if (selectedStudents.length > 85) return setError("Maximum 85 students.");
    if (!subjectId) return setError("Select a subject.");
    if (!numQuestions || Number(numQuestions) <= 0)
      return setError("Enter a valid number of questions.");

    if (!mixedDifficulty && difficultyTotal !== Number(numQuestions)) {
      return setError("Easy + Medium + Hard must equal the number of questions.");
    }

    setAssigning(true);
    try {
      const response = await api.post("/admin/assignments/bulk", {
        student_ids: selectedStudents,
        semester: Number(semester),
        subject_id: Number(subjectId),
        topic_id: topicId ? Number(topicId) : null,
        num_questions: Number(numQuestions),
        time_limit_minutes: timeLimit ? Number(timeLimit) : null,
        easy_questions: Number(easy),
        medium_questions: Number(medium),
        hard_questions: Number(hard),
      });

      setMessage(response.data.message);
      setSelectedStudents([]);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not assign the test.");
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-semibold text-indigo-600">Admin Portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Assign Test</h1>
        <p className="mt-2 text-slate-500">
          Select a semester and assign the same test to multiple students at once.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <form onSubmit={assignTest} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">1. Select Semester</h2>
          <select
            value={semester}
            onChange={(e) => changeSemester(e.target.value)}
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3"
          >
            <option value="">Select semester</option>
            {semesters.map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">2. Students</h2>
              <p className="text-sm text-slate-500">
                {semester
                  ? `${semesterStudents.length} student(s) in Semester ${semester}`
                  : "Choose a semester first"}
              </p>
            </div>
            {semester && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllSemester}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearStudents}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {semester && semesterStudents.length === 0 ? (
            <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              No students have been assigned to this semester yet.
            </p>
          ) : (
            <div className="mt-5 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
              {semesterStudents.map((student) => {
                const checked = selectedStudents.includes(student.user_id);
                return (
                  <label
                    key={student.user_id}
                    className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStudent(student.user_id)}
                      className="h-4 w-4"
                    />
                    <span className="flex-1">
                      <span className="block font-semibold">{student.name}</span>
                      <span className="text-xs text-slate-500">
                        {student.username}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-sm font-semibold text-indigo-700">
            Selected: {selectedStudents.length} / 85
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">3. Test Configuration</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label="Subject">
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setTopicId("");
                }}
                className="input"
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Topic">
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="input"
                disabled={!subjectId}
              >
                <option value="">All topics / Mixed</option>
                {availableTopics.map((topic) => (
                  <option key={topic.topic_id} value={topic.topic_id}>
                    {topic.topic_name} ({topic.question_count})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Number of Questions">
              <input
                type="number"
                min="1"
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Time Limit (minutes, optional)">
              <input
                type="number"
                min="1"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                placeholder="Auto"
                className="input"
              />
            </Field>
          </div>

          <div className="mt-7">
            <h3 className="font-bold">Difficulty Distribution</h3>
            <p className="mt-1 text-sm text-slate-500">
              Leave all at 0 for Mixed difficulty.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Difficulty label="Easy" value={easy} onChange={(e) => updateDifficulty(setEasy, e.target.value)} />
              <Difficulty label="Medium" value={medium} onChange={(e) => updateDifficulty(setMedium, e.target.value)} />
              <Difficulty label="Hard" value={hard} onChange={(e) => updateDifficulty(setHard, e.target.value)} />
            </div>

            <p className={`mt-3 text-sm font-semibold ${
              mixedDifficulty || difficultyTotal === Number(numQuestions)
                ? "text-emerald-700"
                : "text-red-600"
            }`}>
              {mixedDifficulty
                ? "Mixed difficulty"
                : `Difficulty questions: ${difficultyTotal} / ${numQuestions}`}
            </p>
          </div>
        </section>

        <button
          type="submit"
          disabled={assigning || selectedStudents.length === 0}
          className="w-full rounded-xl bg-indigo-600 px-5 py-4 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {assigning
            ? "Assigning..."
            : `Assign Test to ${selectedStudents.length} Student(s)`}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Difficulty({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        className="input"
      />
    </label>
  );
}
