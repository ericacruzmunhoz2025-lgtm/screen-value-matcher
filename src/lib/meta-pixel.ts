// Meta Pixel helper functions

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const trackPurchase = (value: number, currency: string = 'BRL', contentName?: string) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Purchase', {
      value: value / 100, // Convert cents to currency
      currency,
      content_name: contentName,
    });
  }
};

export const trackInitiateCheckout = (value: number, currency: string = 'BRL', contentName?: string) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      value: value / 100,
      currency,
      content_name: contentName,
    });
  }
};
