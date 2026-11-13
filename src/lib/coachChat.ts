import { useCallback, useRef, useState } from "react";
import { PLAN_SEPARATOR, streamCoachChat, type CoachMessage, type PlanSession } from "./api";

// Chat history lives above the popup so it survives closing and reopening the bubble.
export function useCoachChat() {
  const [messages, setMessagesState] = useState<CoachMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const messagesRef = useRef<CoachMessage[]>([]);
  const busyRef = useRef(false);

  const setMessages = useCallback((update: (prev: CoachMessage[]) => CoachMessage[]) => {
    messagesRef.current = update(messagesRef.current);
    setMessagesState(messagesRef.current);
  }, []);

  const send = useCallback(
    async (text: string, display?: string) => {
      const content = text.trim();
      if (!content || busyRef.current) return;
      const history: CoachMessage[] = [...messagesRef.current, { role: "user", content, ...(display ? { display } : {}) }];
      const index = history.length;
      setMessages(() => [...history, { role: "assistant", content: "" }]);

      busyRef.current = true;
      setBusy(true);
      try {
        // Raw stream: reply text, then optionally PLAN_SEPARATOR + the planned sessions' JSON.
        let raw = "";
        await streamCoachChat(history, (delta) => {
          raw += delta;
          const text = raw.split(PLAN_SEPARATOR)[0];
          setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, content: text } : m)));
        });
        const at = raw.indexOf(PLAN_SEPARATOR);
        if (at >= 0) {
          try {
            const sessions = JSON.parse(raw.slice(at + 1)) as PlanSession[];
            setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, sessions } : m)));
          } catch {
            // Malformed plan payload: the text reply still stands.
          }
        }
      } catch (err) {
        const reason = (err as Error).message || "";
        setMessages((prev) =>
          prev.map((m, i) => (i === index ? { ...m, content: `I couldn't reach the coaching model. ${reason}`.trim() } : m))
        );
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [setMessages]
  );

  return { messages, busy, send };
}
