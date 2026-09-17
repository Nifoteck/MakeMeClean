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

export function isActiveUpcomingBooking(status: string, dateStr: string): boolean {
  return ["upcoming", "pending", "confirmed"].includes(status) && !isPastDate(dateStr);
}

export function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `MMC-${year}-${random}`;
}
