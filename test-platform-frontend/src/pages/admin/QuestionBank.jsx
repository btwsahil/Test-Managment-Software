import { useEffect, useState } from "react";
import api from "../../api";

const difficultyOptions = ["Easy", "Medium", "Hard"];

const ACCEPTED_EXTENSIONS =
  ".xlsx,.xls,.csv,.json,.txt,.md,.docx,.pdf,.pptx";

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadQuestions() {
    try {
      setError("");
      const response = await api.get("/admin/questions");
      setQuestions(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load questions.");
    }
  }

  useEffect(() => {
    loadQuestions();
  }, []);

  async function previewFile() {
    if (!file) {
      setError("Please select a question file.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/admin/questions/preview", formData);
      setPreview(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not read this file. Check its format and question structure."
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!preview?.questions?.length) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post(
        "/admin/questions/confirm",
        preview.questions
      );

      setMessage(
        `${response.data.inserted} question(s) imported successfully${
          response.data.skipped
            ? `, ${response.data.skipped} skipped`
            : ""
        }.`
      );
      setPreview(null);
      setFile(null);
      await loadQuestions();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not import questions.");
    } finally {
      setLoading(false);
    }
  }

  async function changeDifficulty(questionId, difficulty) {
    setError("");
    setMessage("");

    try {
      await api.patch(
        `/admin/questions/${questionId}/difficulty`,
        null,
        { params: { difficulty } }
      );

      setQuestions((previous) =>
        previous.map((question) =>
          question.question_id === questionId
            ? { ...question, difficulty }
            : question
        )
      );

      setMessage("Difficulty updated.");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not update difficulty."
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1E293B]">Question Bank</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload questions from Excel, CSV, PDF, Word, JSON, text or PowerPoint.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Import Questions</h2>

        <p className="mt-2 text-sm text-slate-500">
          Supported: <b>Excel, CSV, JSON, TXT, Markdown, Word, PDF and PowerPoint.</b>{" "}
          If a file contains a <b>Difficulty</b> value, that value is used.
          If it is blank or missing, the system automatically estimates
          <b> Easy, Medium or Hard</b>.
        </p>

        <p className="mt-2 text-xs text-slate-400">
          For PDF/Word/TXT/PPTX, use numbered questions with options A-D and an
          Answer line, or a table containing the standard question columns.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setError("");
              setPreview(null);
            }}
            className="block rounded-lg border border-slate-300 p-2 text-sm"
          />

          <button
            onClick={previewFile}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Processing..." : "Preview File"}
          </button>
        </div>

        {file && (
          <p className="mt-3 text-xs text-slate-500">
            Selected: <b>{file.name}</b>
          </p>
        )}

        {preview && (
          <div className="mt-5">
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <b>{preview.total_rows}</b> questions ·{" "}
              <span className="text-emerald-600">
                {preview.valid_count} valid
              </span>{" "}
              ·{" "}
              <span className="text-red-600">
                {preview.error_count} errors
              </span>
              <span className="ml-2 text-slate-500">
                · Detected format: {preview.source_format}
              </span>
            </div>

            <div className="mt-4 max-h-96 overflow-auto rounded-xl border">
              {preview.questions.map((q) => (
                <div
                  key={q.row_number}
                  className="border-b p-3 text-sm last:border-b-0"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <span className="font-semibold">
                      Row {q.row_number}: {q.question}
                    </span>

                    <div className="flex items-center gap-2">
                      <select
                        value={q.difficulty}
                        onChange={(event) => {
                          const difficulty = event.target.value;
                          setPreview((previous) => ({
                            ...previous,
                            questions: previous.questions.map((item) =>
                              item.row_number === q.row_number
                                ? {
                                    ...item,
                                    difficulty,
                                    difficulty_source: "Manual",
                                  }
                                : item
                            ),
                          }));
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold"
                      >
                        {difficultyOptions.map((difficulty) => (
                          <option key={difficulty} value={difficulty}>
                            {difficulty}
                          </option>
                        ))}
                      </select>

                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          q.difficulty_source === "File"
                            ? "bg-blue-50 text-blue-700"
                            : q.difficulty_source === "Manual"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-violet-50 text-violet-700"
                        }`}
                      >
                        {q.difficulty_source === "File"
                          ? "From file"
                          : q.difficulty_source === "Manual"
                            ? "Manual"
                            : "Auto detected"}
                      </span>
                    </div>
                  </div>

                  {q.error && (
                    <p className="mt-1 text-red-600">{q.error}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={confirmImport}
              disabled={loading || preview.valid_count === 0}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirm Import
            </button>
          </div>
        )}
      </section>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-bold">Questions ({questions.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Difficulty</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.question_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{question.question_id}</td>
                  <td className="max-w-xl px-4 py-3">{question.question_text}</td>
                  <td className="px-4 py-3">{question.subject_name}</td>
                  <td className="px-4 py-3">{question.topic_name}</td>
                  <td className="px-4 py-3">
                    <select
                      value={question.difficulty}
                      onChange={(event) =>
                        changeDifficulty(
                          question.question_id,
                          event.target.value
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                        question.difficulty === "Easy"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : question.difficulty === "Hard"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {difficultyOptions.map((difficulty) => (
                        <option key={difficulty} value={difficulty}>
                          {difficulty}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
