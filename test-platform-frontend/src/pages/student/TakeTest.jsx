import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";

function getRemainingSeconds(startTime, timeLimitMinutes) {
  const start = new Date(startTime).getTime();
  const end = start + Number(timeLimitMinutes) * 60 * 1000;
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

export default function TakeTest() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedResult, setSubmittedResult] = useState(null);

  const submitLock = useRef(false);

  // Exam security controls.
  const [violationCount, setViolationCount] = useState(0);
  const [violationMessage, setViolationMessage] = useState("");
  const [examLocked, setExamLocked] = useState(false);
  const fullscreenActive = useRef(false);
  const antiCheatReady = useRef(false);
  const lastViolationAt = useRef(0);

  const registerViolation = useCallback(
    (violationType, message) => {
      if (!test || submittedResult || submitting || submitLock.current || !antiCheatReady.current) return;

      // One user action can trigger multiple browser events (for example blur +
      // visibilitychange), so debounce them into a single violation.
      const now = Date.now();
      if (now - lastViolationAt.current < 1500) return;
      lastViolationAt.current = now;

      // Lock the test immediately after a violation. The student must return to fullscreen before continuing.
      setExamLocked(true);

      // Audit-log the violation. A logging failure must not disable the local anti-cheat behavior.
      api.post(`/student/sessions/${test.session_id}/violation`, {
        violation_type: violationType,
        message,
      }).catch(() => {});

      setViolationCount((previous) => {
        const next = previous + 1;
        if (next === 1) {
          setViolationMessage(
            `${message} This is warning 1 of 2. A second violation will automatically submit the test.`
          );
        } else {
          setViolationMessage(
            "Two exam-security violations were detected. Your test is being submitted automatically."
          );
        }
        return next;
      });
    },
    [test, submittedResult, submitting]
  );

  const loadTest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post(`/student/assignments/${testId}/start`);
      setTest(response.data);
      setSecondsLeft(
        getRemainingSeconds(response.data.start_time, response.data.time_limit_minutes)
      );
    } catch (err) {
      setError(err.response?.data?.detail || "Could not start or resume this test.");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    loadTest();
  }, [loadTest]);

  const submitTest = useCallback(
    async (automatic = false) => {
      if (!test || submitLock.current || submittedResult) return;

      submitLock.current = true;
      setSubmitting(true);
      setError("");

      try {
        const response = await api.post(`/student/sessions/${test.session_id}/submit`);
        setViolationMessage("");
        setSubmittedResult(response.data);
      } catch (err) {
        submitLock.current = false;
        setError(
          err.response?.data?.detail ||
            (automatic
              ? "Time expired, but the submission could not be completed. Please try again."
              : "Could not submit the test.")
        );
      } finally {
        setSubmitting(false);
      }
    },
    [test, submittedResult]
  );

  // Exam security: fullscreen, tab/window switching, fullscreen exit,
  // context menu, copy/paste, and common restricted shortcuts.
  useEffect(() => {
    if (!test || submittedResult) return;

    antiCheatReady.current = false;
    const readyTimer = window.setTimeout(() => {
      antiCheatReady.current = true;
    }, 1500);

    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
        fullscreenActive.current = Boolean(document.fullscreenElement);
      } catch {
        // Some browsers require fullscreen to be initiated by a user gesture.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        registerViolation("tab_switch", "You left the test tab/window.");
      }
    };

    const handleWindowBlur = () => {
      registerViolation("window_blur", "You switched away from the test window.");
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        fullscreenActive.current = true;
      } else if (fullscreenActive.current) {
        fullscreenActive.current = false;
        registerViolation("fullscreen_exit", "You exited fullscreen mode.");
      }
    };

    const handleContextMenu = (event) => {
      event.preventDefault();
    };

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const restricted =
        event.key === "F12" ||
        event.key === "PrintScreen" ||
        (ctrlOrMeta && ["c", "x", "v", "a", "p", "u", "s"].includes(key)) ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key));

      if (restricted) {
        event.preventDefault();
        registerViolation("restricted_shortcut", "A restricted keyboard shortcut was used.");
      }
    };

    const blockClipboard = (event) => {
      event.preventDefault();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("paste", blockClipboard);

    // Request fullscreen after listeners are installed.
    enterFullscreen();

    return () => {
      window.clearTimeout(readyTimer);
      antiCheatReady.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("paste", blockClipboard);
    };
  }, [test, submittedResult, registerViolation]);

  useEffect(() => {
    if (secondsLeft === null || submittedResult) return;

    const timer = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          submitTest(true);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft !== null, submittedResult, submitTest]);

  useEffect(() => {
    if (violationCount >= 2 && test && !submittedResult && !submitLock.current) {
      submitTest(true);
    }
  }, [violationCount, test, submittedResult, submitTest]);

  const currentQuestion = test?.questions?.[currentIndex];

  const selected = currentQuestion
    ? answers[currentQuestion.question_id]
    : undefined;

  async function chooseAnswer(letter) {
    if (!test || !currentQuestion || submitting || examLocked) return;

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.question_id]: letter,
    }));

    setSaving(true);
    try {
      await api.post(`/student/sessions/${test.session_id}/answer`, {
        question_id: currentQuestion.question_id,
        selected_option: letter,
      });
    } catch (err) {
      setAnswers((previous) => {
        const copy = { ...previous };
        delete copy[currentQuestion.question_id];
        return copy;
      });
      setError(err.response?.data?.detail || "Could not save this answer.");
    } finally {
      setSaving(false);
    }
  }

  const formattedTime = useMemo(() => {
    const total = Math.max(0, secondsLeft ?? 0);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [secondsLeft]);

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading test...</div>;
  }

  if (submittedResult) {
    return (
      <ResultCard
        result={submittedResult}
        onResults={() => navigate("/student/results")}
      />
    );
  }

  if (error && !test) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!test || !currentQuestion) return null;

  const questions = test.questions;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="sticky top-0 z-10 mb-5 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Test in progress
            </p>
            <p className="font-bold">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Exam mode • Fullscreen
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  violationCount === 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                Violations: {violationCount}/2
              </span>
            </div>
          </div>
          <div
            className={`rounded-xl px-4 py-2 font-mono text-lg font-bold ${
              (secondsLeft ?? 0) <= 60
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-800"
            }`}
          >
            ⏱ {formattedTime}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {violationMessage && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Exam security warning</p>
              <p className="mt-1">{violationMessage}</p>
            </div>
            {violationCount < 2 && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!document.fullscreenElement) {
                      await document.documentElement.requestFullscreen();
                    }

                    if (document.fullscreenElement) {
                      fullscreenActive.current = true;
                      setExamLocked(false);
                      setViolationMessage("");
                    }
                  } catch {
                    setViolationMessage(
                      "Fullscreen could not be restored. Please enable fullscreen to continue."
                    );
                  }
                }}
                className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Return to Fullscreen
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_250px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold text-slate-400">
            Question {currentIndex + 1}
          </p>
          <h1 className="mt-3 text-xl font-bold leading-8 md:text-2xl">
            {currentQuestion.question_text}
          </h1>

          <div className="mt-8 space-y-3">
            {["A", "B", "C", "D"].map((letter) => (
              <button
                key={letter}
                onClick={() => chooseAnswer(letter)}
                disabled={submitting || examLocked}
                className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${
                  selected === letter
                    ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100"
                    : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    selected === letter
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {letter}
                </span>
                <span className="pt-1 text-sm leading-6 text-slate-700">
                  {currentQuestion[`option_${letter.toLowerCase()}`]}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              disabled={currentIndex === 0 || examLocked}
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>

            <span className="text-xs font-medium text-slate-400">
              {saving ? "Saving answer..." : selected ? "Answer saved" : "Not answered"}
            </span>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((i) => i + 1)}
                disabled={examLocked}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Submit this test now? You will not be able to change your answers afterward."
                    )
                  ) {
                    submitTest(false);
                  }
                }}
                disabled={submitting}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Test"}
              </button>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Questions</h2>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map((question, index) => {
              const answered = Boolean(answers[question.question_id]);
              return (
                <button
                  key={question.question_id}
                  onClick={() => setCurrentIndex(index)}
                  disabled={submitting || examLocked}
                  className={`h-10 rounded-lg text-sm font-semibold ${
                    index === currentIndex
                      ? "bg-indigo-600 text-white"
                      : answered
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-2 text-xs text-slate-500">
            <Legend className="bg-indigo-600" text="Current" />
            <Legend className="bg-emerald-100" text="Answered" />
            <Legend className="bg-slate-100" text="Not answered" />
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <p className="font-semibold text-slate-700">Exam rules</p>
            <p className="mt-1">
              Stay in this tab and keep fullscreen enabled. Copy/paste and
              restricted keyboard shortcuts are disabled. Two violations
              automatically submit the test.
            </p>
          </div>

          <button
            onClick={() => {
              if (
                window.confirm(
                  "Submit this test now? Unanswered questions will be counted as wrong."
                )
              ) {
                submitTest(false);
              }
            }}
            disabled={submitting}
            className="mt-7 w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Submit Test
          </button>
        </aside>
      </div>
    </div>
  );
}

function Legend({ className, text }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${className}`} />
      {text}
    </div>
  );
}

function ResultCard({ result, onResults }) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold text-emerald-600">Test submitted</p>
      <h1 className="mt-2 text-3xl font-bold">Your Result</h1>

      <div className="mx-auto mt-8 flex h-32 w-32 items-center justify-center rounded-full bg-indigo-50">
        <span className="text-3xl font-bold text-indigo-700">
          {Number(result.score_percent).toFixed(0)}%
        </span>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <ResultStat label="Correct" value={result.correct_answers} />
        <ResultStat label="Wrong" value={result.wrong_answers} />
        <ResultStat label="Total" value={result.total_questions} />
      </div>

      {result.weak_topics?.length > 0 && (
        <div className="mt-7 rounded-2xl bg-amber-50 p-5 text-left">
          <p className="font-bold text-amber-800">Topics to review</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.weak_topics.map((topic) => (
              <span key={topic} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onResults}
        className="mt-8 w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
      >
        View My Results
      </button>
    </div>
  );
}

function ResultStat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
