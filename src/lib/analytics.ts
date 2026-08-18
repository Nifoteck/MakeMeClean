export function initializeAnalytics() {
  (window as any).dataLayer = (window as any).dataLayer || [];
}

export function trackPageView(path: string, title: string) {
  if ((window as any).dataLayer) {
    (window as any).dataLayer.push({
      event: 'page_view',
      page_path: path,
      page_title: title,
    });
  }
}

export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  if ((window as any).dataLayer) {
    (window as any).dataLayer.push({
      event: eventName,
      ...(eventData ?? {}),
    });
  }
}

// Track booking events
export function trackBookingStarted() {
  trackEvent('booking_started');
}

export function trackBookingCompleted(bookingId: string, amount: number) {
  trackEvent('booking_completed', {
    booking_id: bookingId,
    amount: amount,
  });
}

// Track sign up
export function trackSignUp() {
  trackEvent('sign_up');
}

// Track sign in
export function trackSignIn() {
  trackEvent('login');
}
