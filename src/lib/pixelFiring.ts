// Shared pixel firing utilities extracted from EntregaPublica.tsx

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
    ttq: any;
    TiktokAnalyticsObject: string;
    gtag: any;
    dataLayer: any[];
    pintrk: any;
    _tfa: any[];
  }
}

export interface PixelInfo {
  platform: string;
  pixel_id: string;
  event_name: string;
}

/** Format phone for Meta Advanced Matching (digits only with country code) */
export const formatPhoneForMeta = (phone: string | null): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 11) {
    digits = '55' + digits;
  }
  if (digits.length < 12) return null;
  return digits;
};

/** Initialize Meta Pixel SDK once */
const ensureMetaSdk = () => {
  if (window.fbq) return;
  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
};

/** Fire all Meta pixels at once using trackSingle to avoid duplicate events */
export const fireMetaPixels = (pixels: { pixel_id: string; event_name: string }[], value: number, phone: string | null) => {
  if (pixels.length === 0) return;

  const formattedPhone = formatPhoneForMeta(phone);
  console.log(`[Pixel] Firing ${pixels.length} Meta pixels with value ${value}, phone: ${formattedPhone}`);

  ensureMetaSdk();

  const advancedMatchingData: { ph?: string; external_id?: string } = {};
  if (formattedPhone) {
    advancedMatchingData.ph = formattedPhone;
    advancedMatchingData.external_id = formattedPhone;
  }

  // Init each pixel with Advanced Matching data
  for (const p of pixels) {
    window.fbq('init', p.pixel_id, advancedMatchingData);
  }

  // Single PageView for all pixels
  window.fbq('track', 'PageView');

  // Use trackSingle to fire exactly 1 event per pixel (no pyramid effect)
  for (const p of pixels) {
    window.fbq('trackSingle', p.pixel_id, p.event_name || 'Purchase', {
      value,
      currency: 'BRL',
      content_type: 'product',
    });
    console.log(`[Pixel] Meta trackSingle ${p.event_name} for ${p.pixel_id}`);
  }
};

/** Load and fire TikTok Pixel */
export const loadTikTokPixel = (pixelId: string, eventName: string, value: number) => {
  console.log(`[Pixel] Loading TikTok Pixel: ${pixelId}`);

  if (!window.ttq) {
    window.TiktokAnalyticsObject = 'ttq';
    const ttq: any = (window.ttq = window.ttq || []);
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = function (t: any, e: string) {
      t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (t: string) {
      const e = ttq._i[t] || [];
      for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
      return e;
    };
    ttq.load = function (e: string, n?: any) {
      const i = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = i;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = n || {};
      const o = document.createElement("script");
      o.type = "text/javascript";
      o.async = true;
      o.src = i + "?sdkid=" + e + "&lib=ttq";
      const a = document.getElementsByTagName("script")[0];
      a.parentNode?.insertBefore(o, a);
    };
  }

  window.ttq.load(pixelId);
  window.ttq.page();
  setTimeout(() => {
    window.ttq.track(eventName || 'CompletePayment', { value, currency: 'BRL' });
    console.log(`[Pixel] TikTok ${eventName} fired with value ${value}`);
  }, 1000);
};

/** Load and fire Google Tag */
export const loadGoogleTag = (tagId: string, eventName: string, value: number) => {
  console.log(`[Pixel] Loading Google Tag: ${tagId}`);
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
  }
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
  script.onload = () => {
    window.gtag('config', tagId);
    window.gtag('event', 'conversion', { send_to: tagId, value, currency: 'BRL' });
    console.log(`[Pixel] Google conversion fired with value ${value}`);
  };
  document.head.appendChild(script);
};

/** Load and fire Pinterest Tag */
export const loadPinterestTag = (tagId: string, eventName: string, value: number) => {
  console.log(`[Pixel] Loading Pinterest Tag: ${tagId}`);
  if (!window.pintrk) {
    window.pintrk = function () { window.pintrk.queue.push(Array.prototype.slice.call(arguments)); };
    const n: any = window.pintrk;
    n.queue = [];
    n.version = "3.0";
  }
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://s.pinimg.com/ct/core.js';
  script.onload = () => {
    window.pintrk('load', tagId);
    window.pintrk('page');
    window.pintrk('track', eventName || 'checkout', { value, currency: 'BRL' });
    console.log(`[Pixel] Pinterest ${eventName} fired with value ${value}`);
  };
  document.head.appendChild(script);
};

/** Load and fire Taboola Pixel */
export const loadTaboolaPixel = (pixelId: string, eventName: string, value: number) => {
  console.log(`[Pixel] Loading Taboola Pixel: ${pixelId}`);
  window._tfa = window._tfa || [];
  window._tfa.push({ notify: 'event', name: 'page_view', id: pixelId });
  const script = document.createElement('script');
  script.async = true;
  script.src = `//cdn.taboola.com/libtrc/unip/${pixelId}/tfa.js`;
  script.onload = () => {
    window._tfa.push({ notify: 'event', name: eventName || 'purchase', id: pixelId, revenue: value });
    console.log(`[Pixel] Taboola ${eventName} fired with value ${value}`);
  };
  document.head.appendChild(script);
};

/** Fire all tracking pixels — groups Meta pixels to avoid duplicate events */
export const firePixels = (pixels: PixelInfo[], value: number, phone: string | null) => {
  console.log(`[Pixel] Firing ${pixels.length} pixels with value ${value}`);

  // Separate Meta pixels from others
  const metaPixels = pixels.filter(p => p.platform === 'meta');
  const otherPixels = pixels.filter(p => p.platform !== 'meta');

  // Fire all Meta pixels together (trackSingle per pixel, no duplicates)
  if (metaPixels.length > 0) {
    fireMetaPixels(
      metaPixels.map(p => ({ pixel_id: p.pixel_id, event_name: p.event_name })),
      value,
      phone
    );
  }

  // Fire other platforms individually
  otherPixels.forEach((pixel) => {
    try {
      switch (pixel.platform) {
        case "tiktok": loadTikTokPixel(pixel.pixel_id, pixel.event_name, value); break;
        case "google": loadGoogleTag(pixel.pixel_id, pixel.event_name, value); break;
        case "pinterest": loadPinterestTag(pixel.pixel_id, pixel.event_name, value); break;
        case "taboola": loadTaboolaPixel(pixel.pixel_id, pixel.event_name, value); break;
        default: console.warn(`[Pixel] Unknown platform: ${pixel.platform}`);
      }
    } catch (err) {
      console.error(`[Pixel] Error firing ${pixel.platform} pixel:`, err);
    }
  });
};
