import { useEffect, useState } from "react";
import api from "../../api";

export default function Results() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function loadResults() {
        try {
            setLoading(true);
            setError("");

            const response = await api.get("/admin/results");
            setResults(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Could not load student results."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadResults();
    }, []);

    if (loading) {
        return (
            <div className="text-[#64748B]">
                Loading results...
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#1E293B]">
                        Test Results
                    </h1>

                    <p className="mt-1 text-sm text-[#64748B]">
                        View performance of students across completed tests.
                    </p>
                </div>

                <button
                    onClick={loadResults}
                    className="rounded-md bg-[#3730A3] px-4 py-2 text-sm font-medium text-white hover:bg-[#312E81]"
                >
                    Refresh
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* No results */}
            {!error && results.length === 0 && (
                <div className="rounded-lg border border-[#E2E0D9] bg-white p-8 text-center">
                    <h2 className="text-lg font-semibold text-[#1E293B]">
                        No results yet
                    </h2>

                    <p className="mt-2 text-sm text-[#64748B]">
                        Results will appear here after students complete tests.
                    </p>
                </div>
            )}

            {/* Results table */}
            {results.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-[#E2E0D9] bg-white">

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">

                            <thead className="bg-[#F8F7F4]">
                                <tr className="border-b border-[#E2E0D9]">

                                    <th className="px-4 py-3 text-left font-semibold text-[#1E293B]">
                                        Student
                                    </th>

                                    <th className="px-4 py-3 text-left font-semibold text-[#1E293B]">
                                        Subject
                                    </th>

                                    <th className="px-4 py-3 text-left font-semibold text-[#1E293B]">
                                        Topic
                                    </th>

                                    <th className="px-4 py-3 text-center font-semibold text-[#1E293B]">
                                        Total
                                    </th>

                                    <th className="px-4 py-3 text-center font-semibold text-[#1E293B]">
                                        Correct
                                    </th>

                                    <th className="px-4 py-3 text-center font-semibold text-[#1E293B]">
                                        Wrong
                                    </th>

                                    <th className="px-4 py-3 text-center font-semibold text-[#1E293B]">
                                        Score
                                    </th>

                                    <th className="px-4 py-3 text-left font-semibold text-[#1E293B]">
                                        Weak Topics
                                    </th>

                                </tr>
                            </thead>

                            <tbody>
                                {results.map((result) => (
                                    <tr
                                        key={result.result_id}
                                        className="border-b border-[#E2E0D9] last:border-b-0 hover:bg-[#FAFAF8]"
                                    >

                                        <td className="px-4 py-4">
                                            <div className="font-medium text-[#1E293B]">
                                                {result.student_name}
                                            </div>

                                            <div className="text-xs text-[#64748B]">
                                                ID: {result.student_id}
                                            </div>
                                        </td>

                                        <td className="px-4 py-4 text-[#1E293B]">
                                            {result.subject_name}
                                        </td>

                                        <td className="px-4 py-4 text-[#64748B]">
                                            {result.topic_name || "—"}
                                        </td>

                                        <td className="px-4 py-4 text-center">
                                            {result.total_questions}
                                        </td>

                                        <td className="px-4 py-4 text-center font-medium text-green-600">
                                            {result.correct_answers}
                                        </td>

                                        <td className="px-4 py-4 text-center text-red-600">
                                            {result.wrong_answers}
                                        </td>

                                        <td className="px-4 py-4 text-center">
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${Number(result.score_percent) >= 80
                                                        ? "bg-green-100 text-green-700"
                                                        : Number(result.score_percent) >= 50
                                                            ? "bg-yellow-100 text-yellow-700"
                                                            : "bg-red-100 text-red-700"
                                                    }`}
                                            >
                                                {Number(result.score_percent).toFixed(1)}%
                                            </span>
                                        </td>

                                        <td className="px-4 py-4">
                                            {result.weak_topics?.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {result.weak_topics.map((topic, index) => (
                                                        <span
                                                            key={index}
                                                            className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-600"
                                                        >
                                                            {topic}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-[#64748B]">
                                                    None
                                                </span>
                                            )}
                                        </td>

                                    </tr>
                                ))}
                            </tbody>

                        </table>
                    </div>

                    <div className="border-t border-[#E2E0D9] px-4 py-3 text-xs text-[#64748B]">
                        Total completed tests: {results.length}
                    </div>

                </div>
            )}

        </div>
    );
}