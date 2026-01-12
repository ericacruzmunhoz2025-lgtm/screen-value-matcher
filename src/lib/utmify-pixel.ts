// UTMify Pixel helper functions

declare global {
  interface Window {
    pixelId?: string;
    Utmify?: {
      trackPurchase: (value: number, orderId?: string, currency?: string) => void;
    };
  }
}

export const trackUtmifyPurchase = (valueCents: number, orderId?: string) => {
  if (typeof window !== 'undefined' && window.Utmify?.trackPurchase) {
    window.Utmify.trackPurchase(valueCents / 100, orderId, 'BRL');
    console.log('UTMify Purchase tracked:', valueCents / 100, orderId);
  }
};
