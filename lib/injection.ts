/**
 * JavaScript and CSS injection engine for the DocVault WebView.
 * Injects ad-blocking, mobile viewport fixes, dark mode, and
 * forced responsive layout into loaded pages.
 */

/** Base ad-block + mobile CSS injected into every page */
export const BASE_CSS_INJECTION = `
(function() {
  const style = document.createElement('style');
  style.textContent = \`
    /* Remove common ad containers */
    .adsbygoogle, [id*="google_ads"], [class*="ad-banner"],
    [class*="advertisement"], [id*="advertisement"],
    .sponsored, [data-ad], [data-advertisement],
    iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
    ins.adsbygoogle, .pub_300x250, .pub_300x600,
    [id*="carbonads"], .carbon-ads, #carbonads,
    .ad-container, .ad-wrapper, .ads-container,
    [class*="sidebar-ad"], [id*="sidebar-ad"],
    .cookie-banner, .cookie-consent, [class*="cookie-notice"],
    .gdpr-banner, [class*="consent-banner"],
    .newsletter-popup, .popup-overlay, .modal-overlay,
    [class*="paywall"], [class*="subscribe-wall"],
    .overlay-container, .interstitial-wrapper { 
      display: none !important; 
      visibility: hidden !important;
      pointer-events: none !important;
    }

    /* Force mobile-friendly layout */
    body {
      max-width: 100vw !important;
      overflow-x: hidden !important;
      word-wrap: break-word !important;
      -webkit-text-size-adjust: 100% !important;
    }
    
    img, video, iframe, embed {
      max-width: 100% !important;
      height: auto !important;
    }

    pre, code {
      white-space: pre-wrap !important;
      word-break: break-all !important;
      max-width: 100% !important;
      overflow-x: auto !important;
    }

    table {
      display: block !important;
      overflow-x: auto !important;
      max-width: 100% !important;
    }
  \`;
  document.head.appendChild(style);
})();
`;

/** Dark mode override for sites that don't support it natively */
export const DARK_MODE_CSS = `
(function() {
  const style = document.createElement('style');
  style.textContent = \`
    @media (prefers-color-scheme: dark) {
      html { filter: invert(1) hue-rotate(180deg); }
      img, video, [class*="logo"], svg { filter: invert(1) hue-rotate(180deg); }
    }
  \`;
  document.head.appendChild(style);
})();
`;

/** Force mobile viewport meta tag */
export const VIEWPORT_FIX = `
(function() {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
})();
`;

/** Block navigation to third-party ad domains */
export const NAV_INTERCEPT = `
(function() {
  const blocked = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'adnxs.com', 'adsystem.com', 'amazon-adsystem.com',
    'taboola.com', 'outbrain.com', 'criteo.com',
    'rubiconproject.com', 'openx.net', 'pubmatic.com',
  ];
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (blocked.some(d => String(url).includes(d))) return;
    origOpen.call(this, method, url, ...rest);
  };
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
    if (blocked.some(d => url.includes(d))) {
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return origFetch.call(this, input, init);
  };
})();
`;

/** Remove cookie/GDPR banners after DOM is ready */
export const COOKIE_REMOVER = `
(function removeBanners() {
  const selectors = [
    '#onetrust-consent-sdk', '.onetrust-banner-sdk', 
    '#cookie-banner', '.cookie-bar', '.cc-window',
    '[class*="cookie-consent"]', '[id*="cookie-consent"]',
    '[class*="gdpr"]', '[id*="gdpr"]',
    '#qc-cmp2-container', '.qc-cmp-showing',
    '.fc-consent-root', '#fc-consent-root',
  ];
  const remove = () => {
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });
    document.body && (document.body.style.overflow = 'auto');
    document.documentElement.style.overflow = 'auto';
  };
  remove();
  setTimeout(remove, 1000);
  setTimeout(remove, 3000);
})();
`;

/** Per-source CSS overrides keyed by source ID */
export const SOURCE_CSS_OVERRIDES: Record<string, string> = {
  w3schools: `
(function() {
  const s = document.createElement('style');
  s.textContent = \`
    #mySidenav, .sidenav, .w3-sidebar, #googleTop, #googleBottom { display: none !important; }
    #main, .w3-main { margin-left: 0 !important; width: 100% !important; }
    .w3-row-padding { padding: 0 8px !important; }
    .w3-third, .w3-quarter { width: 100% !important; }
  \`;
  document.head.appendChild(s);
})();`,

  mdn: `
(function() {
  const s = document.createElement('style');
  s.textContent = \`
    .sidebar, aside.sidebar { display: none !important; }
    .article-container, main.article-container { max-width: 100% !important; margin: 0 !important; }
    .article-actions-container { position: relative !important; }
  \`;
  document.head.appendChild(s);
})();`,

  devdocs: `
(function() {
  const s = document.createElement('style');
  s.textContent = \`
    ._sidebar { width: 0 !important; overflow: hidden !important; }
    ._content { margin-left: 0 !important; }
  \`;
  document.head.appendChild(s);
})();`,
};

/**
 * Builds the full injection script for a given source.
 * Always injects: viewport fix, base CSS, nav intercept, cookie remover.
 * Adds per-source CSS if defined.
 * Adds dark mode if requested.
 */
export function buildInjectionScript(sourceId: string, darkMode = false): string {
  const parts: string[] = [
    VIEWPORT_FIX,
    BASE_CSS_INJECTION,
    NAV_INTERCEPT,
    COOKIE_REMOVER,
  ];

  if (SOURCE_CSS_OVERRIDES[sourceId]) {
    parts.push(SOURCE_CSS_OVERRIDES[sourceId]);
  }

  if (darkMode) {
    parts.push(DARK_MODE_CSS);
  }

  return parts.join('\n');
}

/** Returns the injected User-Agent string to use for WebView */
export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
