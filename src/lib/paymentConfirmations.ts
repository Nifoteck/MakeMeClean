import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "makemeclean:pending-stripe-confirmations";
const MAX_ATTEMPTS = 20;

type PendingConfirmation = {
  bookingId: string;
  sessionId: string;
  attempts: number;
  createdAt: number;
  lastAttemptAt?: number;
};

function readQueue(): PendingConfirmation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingConfirmation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function queuePaymentConfirmation(bookingId: string, sessionId: string) {
  const queue = readQueue();
  const existing = queue.find((item) => item.bookingId === bookingId && item.sessionId === sessionId);
  if (existing) return;

  writeQueue([
    ...queue,
    { bookingId, sessionId, attempts: 0, createdAt: Date.now() },
  ]);
}

export async function flushPaymentConfirmations() {
  if (typeof window === "undefined" || !navigator.onLine) return;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;

  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining: PendingConfirmation[] = [];

  for (const item of queue) {
    try {
      const { data, error } = await supabase.functions.invoke("confirm-stripe-checkout", {
        body: { bookingId: item.bookingId, sessionId: item.sessionId },
      });

      if (!error && data?.paid) continue;

      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastAttemptAt: Date.now(),
      });
    } catch {
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastAttemptAt: Date.now(),
      });
    }
  }

  writeQueue(remaining.filter((item) => item.attempts < MAX_ATTEMPTS));
}

export function startPaymentConfirmationRetries() {
  if (typeof window === "undefined") return () => {};

  const flush = () => {
    void flushPaymentConfirmations();
  };

  flush();
  window.addEventListener("online", flush);
  window.addEventListener("focus", flush);
  document.addEventListener("visibilitychange", flush);
  const timer = window.setInterval(flush, 30000);

  return () => {
    window.removeEventListener("online", flush);
    window.removeEventListener("focus", flush);
    document.removeEventListener("visibilitychange", flush);
    window.clearInterval(timer);
  };
}
