import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function isPastDate(dateStr: string): boolean {
  const bookingDate = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Number.isFinite(bookingDate.getTime()) && bookingDate < today;
}

/**
 * Returns true if the scheduled slot time on the booking date has already passed.
 * e.g., date: "2026-10-29", timeSlot: "11:00 – 18:00" -> checks whether current time > 11:00 on 2026-10-29.
 */
export function isBookingStartTimePassed(dateStr: string, timeSlot?: string | null): boolean {
  if (!dateStr) return false;
  const startHourStr = (timeSlot || "09:00").split(/[-–]/)[0]?.trim() || "09:00";
  const [hour, min] = startHourStr.split(":").map(Number);
  const scheduledTime = new Date(`${dateStr}T${String(hour || 9).padStart(2, "0")}:${String(min || 0).padStart(2, "0")}:00`);
  const now = new Date();
  return Number.isFinite(scheduledTime.getTime()) && now > scheduledTime;
}

/**
 * Returns true if the entire scheduled cleaning slot has concluded.
 * e.g., date: "2026-10-29", timeSlot: "11:00 – 18:00" -> checks whether current time > 18:00 on 2026-10-29.
 */
export function isBookingEndTimePassed(dateStr: string, timeSlot?: string | null, durationHours?: number | null): boolean {
  if (!dateStr) return false;
  const parts = (timeSlot || "").split(/[-–]/).map((p) => p.trim());
  let endHour = 11;
  let endMin = 0;

  if (parts.length >= 2 && parts[1]) {
    const [h, m] = parts[1].split(":").map(Number);
    if (Number.isFinite(h)) endHour = h;
    if (Number.isFinite(m)) endMin = m || 0;
  } else {
    const startStr = parts[0] || "09:00";
    const [startH, startM] = startStr.split(":").map(Number);
    const duration = durationHours || 2;
    const totalMinutes = (startH || 9) * 60 + (startM || 0) + Math.round(duration * 60);
    endHour = Math.floor(totalMinutes / 60);
    endMin = totalMinutes % 60;
  }

  const scheduledEnd = new Date(
    `${dateStr}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`
  );
  const now = new Date();
  return Number.isFinite(scheduledEnd.getTime()) && now > scheduledEnd;
}

export function isActiveUpcomingBooking(status: string, dateStr: string, timeSlot?: string | null, paymentStatus?: string | null): boolean {
  if (status === "cancelled" || status === "completed") return false;
  // If payment hasn't been completed and the start time has already arrived/passed, it's expired/cancelled
  if (paymentStatus !== "paid" && isBookingStartTimePassed(dateStr, timeSlot)) return false;
  // If paid and the end time has passed, it has moved to pending completion (no longer upcoming)
  if (paymentStatus === "paid" && isBookingEndTimePassed(dateStr, timeSlot)) return false;
  return ["upcoming", "pending", "confirmed"].includes(status) && !isPastDate(dateStr);
}

export function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `MMC-${year}-${random}`;
}

/**
 * Extracts clean user notes by stripping legacy bracketed metadata tags like
 * [Access: ...], [Supplies: ...], [Parking: ...], [Pets: ...].
 */
export function sanitizeCleanNotes(rawNotes?: string | null): string {
  if (!rawNotes) return "";
  return rawNotes
    .replace(/\[Access:\s*[^\]]+\]/gi, "")
    .replace(/\[Supplies:\s*[^\]]+\]/gi, "")
    .replace(/\[Parking:\s*[^\]]+\]/gi, "")
    .replace(/\[Pets:\s*[^\]]+\]/gi, "")
    .replace(/^[\s"\n]+|[\s"\n]+$/g, "")
    .trim();
}
