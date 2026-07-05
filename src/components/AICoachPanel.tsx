import { useState } from "react";
import { askAiCoach } from "../lib/api";

export function AICoachPanel() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ configured: boolean; message: string } | null>(null);

  const handleAsk = async () => {
    setLoading(true);
    try {
      const result = await askAiCoach();
      setResponse(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">AI Coach</h2>
          <p className="text-sm text-white/50">Get a plain-language read on your training</p>
        </div>
        <button
          onClick={handleAsk}
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask Coach"}
        </button>
      </div>

      {response ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            response.configured ? "border-white/10 bg-tri-soft text-white/80" : "border-tri-orange/30 bg-tri-orange/10 text-tri-orange"
          }`}
        >
          {response.message}
        </div>
      ) : (
        <p className="text-sm text-white/50">
          Click "Ask Coach" for guidance based on your recent training, upcoming races, and readiness score.
        </p>
      )}
    </section>
  );
}
