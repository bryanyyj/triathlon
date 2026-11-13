import { useEffect, useRef, useState } from "react";
import { getCoachStatus, type CoachMessage, type CoachStatus } from "../lib/api";
import { CoachText } from "./CoachText";
import { PlanCards } from "./PlanCards";

const SUGGESTIONS = [
  "Plan my next 7 days",
  "Should I train hard today?",
  "I feel flat, make tomorrow easier",
  "How's my form looking?",
];

type CoachChatProps = {
  messages: CoachMessage[];
  busy: boolean;
  send: (text: string) => Promise<void>;
};

export function CoachChat({ messages, busy, send }: CoachChatProps) {
  const [input, setInput] = useState("");
  // undefined = still checking, null = backend unreachable.
  const [status, setStatus] = useState<CoachStatus | null | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getCoachStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const ready = Boolean(status?.configured && !status.blocked);

  // Seconds since the current request started, so a slow free model doesn't look frozen.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (ready) inputRef.current?.focus();
  }, [ready]);

  const offlineNote =
    status === null
      ? "The backend is not reachable, so the coach is offline."
      : status && !status.configured
        ? "Add OPENROUTER_API_KEY to backend/.env and restart the backend to start chatting."
        : status?.blocked
          ? `"${status.model}" is a paid model. Set OPENROUTER_MODEL to a ":free" model, or OPENROUTER_ALLOW_PAID=true, in backend/.env.`
          : null;

  const autoGrow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const submit = (text: string) => {
    if (!text.trim() || busy || !ready) return;
    setInput("");
    requestAnimationFrame(autoGrow);
    void send(text);
  };

  return (
    <>
      <div ref={scrollRef} className="tri-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-2">
            <p className="text-sm text-white/60">
              Ask about your training, or have the coach plan and change workouts. Anything it plans shows up on your
              calendar.
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                disabled={!ready}
                onClick={() => submit(suggestion)}
                className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 text-left text-sm text-white/80 hover:border-tri-purple disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
            {offlineNote && <p className="text-xs text-tri-orange">{offlineNote}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message, i) =>
              message.role === "user" ? (
                <div
                  key={i}
                  className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-tri-purple px-3.5 py-2 text-sm text-white"
                >
                  {message.display ?? message.content}
                </div>
              ) : (
                <div key={i} className="min-w-0 text-sm text-white/85">
                  {message.content ? (
                    <CoachText>{message.content}</CoachText>
                  ) : message.sessions?.length ? null : busy && i === messages.length - 1 ? (
                    <span className="text-white/40" role="status">
                      Thinking…{elapsed >= 8 && ` ${elapsed}s · free models can take up to a minute to start`}
                    </span>
                  ) : (
                    <span className="text-white/40">No reply. Try sending it again.</span>
                  )}
                  {message.sessions?.length ? <PlanCards sessions={message.sessions} /> : null}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-tri-soft py-1.5 pl-3 pr-1.5 focus-within:border-tri-purple">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            disabled={!ready || busy}
            placeholder={ready ? "Message your coach…" : "Coach offline"}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            className="max-h-[120px] flex-1 resize-none bg-transparent py-1.5 text-sm text-white placeholder-white/30 outline-none"
          />
          <button
            aria-label="Send message"
            disabled={!ready || busy || input.trim() === ""}
            onClick={() => submit(input)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-tri-purple to-tri-pink text-white disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 11.5 20 4l-7.5 16-2.5-7z" />
              <path d="M12.5 11.5 20 4" />
            </svg>
          </button>
        </div>
        {ready && status && (
          <p className="mt-1.5 text-center text-[10px] text-white/30">
            {status.model}
            {status.free ? " · free" : ""}
          </p>
        )}
      </div>
    </>
  );
}
