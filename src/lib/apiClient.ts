import { supabase } from './supabase';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status = 400, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : endpoint;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await res.json().catch(() => ({
    ok: false,
    error: `HTTP Error ${res.status}: ${res.statusText}`,
  }));

  if (!res.ok || json.ok === false) {
    throw new ApiError(json.error || `Request failed with status ${res.status}`, res.status, json.details);
  }

  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  // ─── Config & System ──────────────────────────────────────────────────────
  getConfig: () => request('/api/config'),
  getSettings: () => request<Record<string, string>>('/api/settings'),
  getServiceCities: () => request<string[]>('/api/service-cities'),
  getServices: () => request<any[]>('/api/services'),

  // ─── Dashboard ────────────────────────────────────────────────────────────
  getDashboard: () => request<{
    profile: any;
    counts: { total: number; upcoming: number; in_progress: number; completed: number; cancelled: number };
    recent_bookings: any[];
    services: any[];
    loyalty: { points: number; tier: string; discount_percent: number; next_tier_points: number };
    unread_notifications_count: number;
  }>('/api/dashboard'),

  // ─── Booking Options & Creation ───────────────────────────────────────────
  getBookingOptions: () => request<{
    services: any[];
    cities: string[];
    discounts: Record<string, number>;
    startHours: string[];
    minDurationHours: number;
    maxDurationHours: number;
    durationStepHours: number;
  }>('/api/booking-options'),

  createBooking: (payload: {
    serviceId: string;
    date: string;
    startHour?: string;
    durationHours?: number;
    timeSlot?: string;
    address: string;
    city: string;
    postcode: string;
    notes?: string;
    recurringFreq?: string;
  }) => request<{ booking: any; invoiceNumber: string }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // ─── Bookings Management ──────────────────────────────────────────────────
  getBookings: (status?: string) =>
    request<any[]>(status && status !== 'all' ? `/api/bookings?status=${encodeURIComponent(status)}` : '/api/bookings'),

  getBooking: (id: string) => request<any>(`/api/bookings/${id}`),

  cancelBooking: (id: string) => request<any>(`/api/bookings/${id}/cancel`, {
    method: 'POST',
  }),

  // ─── Reschedules ──────────────────────────────────────────────────────────
  getReschedule: (bookingId: string) => request<any>(`/api/bookings/${bookingId}/reschedule`),

  requestReschedule: (bookingId: string, payload: {
    requestedDate: string;
    requestedTime: string;
    reason?: string;
  }) => request<any>(`/api/bookings/${bookingId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // ─── Checkout & Payments ──────────────────────────────────────────────────
  createCheckoutSession: (bookingId: string, payload?: { returnUrl?: string }) =>
    request<{ sessionId: string; checkoutUrl: string; bookingId: string; amount: number }>(
      `/api/bookings/${bookingId}/checkout`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    ),

  // ─── Invoices ─────────────────────────────────────────────────────────────
  getInvoice: (bookingId: string) => request<any>(`/api/bookings/${bookingId}/invoice`),

  // ─── Photos ───────────────────────────────────────────────────────────────
  getBookingPhotos: (bookingId: string) => request<{ all: any[]; before: any[]; after: any[] }>(`/api/bookings/${bookingId}/photos`),

  addBookingPhoto: (bookingId: string, payload: { photoUrl: string; photoType: 'before' | 'after' }) =>
    request<any>(`/api/bookings/${bookingId}/photos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteBookingPhoto: (bookingId: string, photoId: string) =>
    request<any>(`/api/bookings/${bookingId}/photos?photoId=${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
    }),

  // ─── Refunds ──────────────────────────────────────────────────────────────
  requestRefund: (bookingId: string, payload: { reason: string; amount?: number }) =>
    request<any>(`/api/bookings/${bookingId}/refund`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── Recurring Plans ──────────────────────────────────────────────────────
  getPlans: () => request<any[]>('/api/plans'),

  updatePlanStatus: (planId: string, status: 'active' | 'paused' | 'cancelled') =>
    request<any>(`/api/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // ─── Contact, Loyalty, Notifications ──────────────────────────────────────
  sendContactMessage: (payload: { name: string; email: string; phone?: string; subject?: string; message: string }) =>
    request<any>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLoyalty: () => request<any>('/api/loyalty'),

  getNotifications: () => request<any[]>('/api/notifications'),

  markNotificationsRead: (notificationId?: string) =>
    request<any>('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationId }),
    }),
};

