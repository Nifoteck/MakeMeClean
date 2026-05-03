// Google Analytics initialization
export function initializeAnalytics() {
  // Load Google Analytics script
  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX'; // Replace with your GA ID
  document.head.appendChild(gtagScript);

  // Initialize gtag
  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(arguments);
  }
  (window as any).gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', {
    page_path: window.location.pathname,
  });
}

// Track page views (call this after page navigation)
export function trackPageView(path: string, title: string) {
  if ((window as any).gtag) {
    (window as any).gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    });
  }
}

// Track custom events
export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  if ((window as any).gtag) {
    (window as any).gtag('event', eventName, eventData);
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
