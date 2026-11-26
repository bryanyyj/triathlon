import { useEffect, useState } from "react";
import type { useCoachChat } from "../lib/coachChat";
import { CoachChat } from "./CoachChat";

type CoachBubbleProps = {
  // Chat state and open state live in the dashboard so other cards (e.g. History's
  // Review buttons) can open the bubble and send a message.
  chat: ReturnType<typeof useCoachChat>;
  open: boolean;
  setOpen: (update: boolean | ((open: boolean) => boolean)) => void;
  onPlanChanged: () => void;
  // Set on pages that open the coach from their own button.
  hideLauncher?: boolean;
};

// Floating chat bubble (bottom right). onPlanChanged fires after each reply so the
// dashboard can pick up workouts the coach added or changed.
const MAXIMIZED_KEY = "coach-maximized";

function readMaximized(): boolean {
  try {
    return localStorage.getItem(MAXIMIZED_KEY) === "1";
  } catch {
    return false;
  }
}

export function CoachBubble({ chat, open, setOpen, onPlanChanged, hideLauncher }: CoachBubbleProps) {
  // Remembered per browser, so long-reply readers get the big view every time.
  const [maximized, setMaximizedState] = useState(readMaximized);
  const setMaximized = (value: boolean) => {
    setMaximizedState(value);
    try {
      localStorage.setItem(MAXIMIZED_KEY, value ? "1" : "0");
    } catch {
      // Storage unavailable (private mode); the toggle still works for this visit.
    }
  };

  useEffect(() => {
    if (!open) return;
    // Escape steps back: maximized → normal → closed.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (maximized) setMaximized(false);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, maximized]);

  const send = async (text: string) => {
    await chat.send(text);
    onPlanChanged();
  };

  return (
    <>
      {open && maximized && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setMaximized(false)} aria-hidden="true" />
      )}
      {open && (
        <div
          role="dialog"
          aria-label="AI coach"
          aria-modal={maximized || undefined}
          className={`fixed z-50 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-tri-card shadow-2xl shadow-black/60 ${
            maximized
              ? "inset-x-4 inset-y-4 mx-auto max-w-4xl md:inset-y-8"
              : "bottom-24 right-6 h-[min(36rem,calc(100vh-8rem))] w-[min(24rem,calc(100vw-3rem))]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-white">AI Coach</h2>
              <p className="text-xs text-white/50">Plans and adjusts your workouts</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMaximized(!maximized)}
                aria-label={maximized ? "Restore coach size" : "Maximize coach"}
                title={maximized ? "Restore" : "Maximize"}
                className="rounded-lg bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {maximized ? (
                    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                  ) : (
                    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                  )}
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close coach"
                className="rounded-lg bg-white/5 px-2.5 py-1 text-sm text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          </div>
          <CoachChat messages={chat.messages} busy={chat.busy} send={send} />
        </div>
      )}

      {!hideLauncher && (
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close coach" : "Open coach"}
        aria-expanded={open}
        title="AI Coach"
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-tri-purple to-tri-pink text-white shadow-lg shadow-black/50 transition-transform hover:scale-105"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 3.5V17H4A1.5 1.5 0 0 1 2.5 15.5V7A1.5 1.5 0 0 1 4 5.5Z" />
        </svg>
      </button>
      )}
    </>
  );
}
