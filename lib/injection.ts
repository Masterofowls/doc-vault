/**
 * JavaScript and CSS injection engine for the DocVault WebView.
 * Comprehensive ad-blocking, tracking prevention, cookie removal,
 * reading mode, and adaptive mobile layout.
 */

// ─── BLOCKED DOMAINS (XHR + Fetch intercept) ────────────────────────────────

const BLOCKED_DOMAINS = [
  // Ad networks
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'googletagservices.com', 'googletagmanager.com', 'google-analytics.com',
  'adnxs.com', 'adsystem.com', 'amazon-adsystem.com',
  'taboola.com', 'outbrain.com', 'criteo.com', 'criteo.com',
  'rubiconproject.com', 'openx.net', 'pubmatic.com', 'casalemedia.com',
  'media.net', 'sovrn.com', 'lijit.com', 'bidswitch.net',
  'smartadserver.com', 'appnexus.com', 'adroll.com', 'spotxchange.com',
  'sharethrough.com', 'triplelift.com', 'teads.tv', 'adform.net',
  // Mobile ads
  'inmobi.com', 'mopub.com', 'flurry.com', 'mobvista.com', 'mintegral.com',
  'applovin.com', 'ironsrc.com', 'unity3d.com/ads', 'vungle.com',
  'chartboost.com', 'tapjoy.com', 'startapp.com', 'admob.com',
  'facebook.com/tr', 'connect.facebook.net',
  // Tracking & analytics
  'segment.com', 'mixpanel.com', 'amplitude.com', 'heap.io',
  'fullstory.com', 'hotjar.com', 'mouseflow.com', 'inspectlet.com',
  'luckyorange.com', 'crazyegg.com', 'clarity.ms',
  'newrelic.com', 'nr-data.net', 'datadog-browser-agent.com',
  'sentry.io', 'bugsnag.com', 'rollbar.com',
  // Beacon / stats
  'cloudflareinsights.com', 'statcounter.com', 'counter.dev',
  'plausible.io', 'matomo.cloud', 'piwik.pro', 'fathom.com',
  // Social tracking pixels
  'linkedin.com/px', 'snap.com/pixel', 'ads.twitter.com', 'ads.tiktok.com',
  't.co/i/', 'analytics.twitter.com', 'pin.it', 'reddit-pixel',
  // Consent / CMP platforms (JS)
  'onetrust.com', 'cookiebot.com', 'quantcast.com', 'evidon.com',
  'usercentrics.eu', 'cookieinformation.com', 'didomi.io',
].join('|');

// ─── CORE INJECTION SCRIPTS ──────────────────────────────────────────────────

/** Intercept XHR/Fetch to blocked domains */
export const NETWORK_BLOCK_JS = `
(function() {
  const blockedPattern = new RegExp('(${BLOCKED_DOMAINS.replace(/\./g, '\\\\.')})', 'i');
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (blockedPattern.test(String(url))) return;
    return origOpen.apply(this, arguments);
  };
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
    if (blockedPattern.test(url)) {
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return origFetch.apply(this, arguments);
  };
  // Block beacon
  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      if (blockedPattern.test(String(url))) return true;
      return origBeacon(url, data);
    };
  }
})();
`;

/** Force mobile viewport */
export const VIEWPORT_FIX = `
(function() {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
})();
`;

/** Comprehensive CSS-based ad + element blocking */
export const AD_BLOCK_CSS = `
(function() {
  const s = document.createElement('style');
  s.id = '__dv_adblock';
  s.textContent = \`
    /* ── Basic display ads ── */
    .adsbygoogle, ins.adsbygoogle,
    [id*="google_ads"], [id*="google-ads"], [class*="google-ad"],
    [class*="ad-banner"], [class*="ad_banner"], [id*="ad-banner"],
    [class*="advertisement"], [id*="advertisement"], [data-advertisement],
    [class*="ad-container"], [id*="ad-container"], [class*="ads-container"],
    [class*="ad-wrapper"], [id*="ad-wrapper"],
    [class*="display-ad"], [id*="display-ad"],
    [data-ad], [data-ad-unit], [data-ad-slot], [data-ad-format],
    .pub_300x250, .pub_300x600, .pub_728x90, .pub_160x600,
    #carbonads, .carbon-ads, [id*="carbonads"], [class*="carbon-ad"],
    #kofi-widget-overlay, .kofi-button-overlay,
    .adnxs, [class*="adnxs"], .taboola, [class*="taboola"],
    .outbrain, [class*="outbrain"], [class*="ob-widget"],
    [class*="sponsored-content"], [class*="native-ad"],
    [class*="native_ad"], [id*="native-ad"], [id*="native_ad"],
    .promoted, [class*="promoted-content"], [class*="sponsored"],

    /* ── Mobile ad SDKs injected iframes/divs ── */
    [class*="mopub"], [class*="admob"], [class*="inmobi"],
    [class*="applovin"], [class*="ironsource"],
    iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
    iframe[src*="adnxs"], iframe[src*="taboola"],
    iframe[src*="amazon-adsystem"], iframe[src*="media.net"],
    iframe[src*="fbcdn"][class*="ad"], iframe[src*="fbad"],

    /* ── Sidebars with ads ── */
    [class*="sidebar-ad"], [id*="sidebar-ad"], [class*="ad-sidebar"],
    [class*="right-rail"], [id*="right-rail"], .rightRail,
    [class*="sticky-ad"], [id*="sticky-ad"],
    [class*="floating-ad"], [id*="floating-ad"],
    [class*="ad-slot"], [id*="ad-slot"],
    [data-dfp], [data-gpt],

    /* ── Cookie / GDPR banners ── */
    #onetrust-consent-sdk, .onetrust-banner-sdk, #onetrust-banner-sdk,
    #onetrust-pc-sdk, .onetrust-pc-dark-filter, #onetrust-accept-btn-handler,
    .cookie-banner, .cookie-bar, .cookie-notice, .cookie-popup,
    #cookie-banner, #cookie-bar, #cookie-notice, #cookie-popup,
    [class*="cookie-consent"], [id*="cookie-consent"],
    [class*="cookie_consent"], [id*="cookie_consent"],
    [class*="cookie-law"], [id*="cookie-law"],
    [class*="gdpr"], [id*="gdpr"],
    [class*="consent-banner"], [id*="consent-banner"],
    [class*="consent-modal"], [id*="consent-modal"],
    .cc-window, .cc-banner, .cc-floating, .cc-grower, .cc-revoke,
    #cc-main, #cc-container, .cc-overlay, .cc-invisible,
    #qc-cmp2-container, .qc-cmp-showing, .qc-cmp2-container,
    .fc-consent-root, #fc-consent-root, .fc-dialog-container,
    #CybotCookiebotDialog, .CybotCookiebotFader,
    [id*="cookiebot"], [class*="cookiebot"],
    .cli-bar-container, #cli-bar-container,
    [id*="cookie-law-info-bar"], [class*="cookie-law-info"],
    .wt-cli-cookie-bar-container, #wt-cli-cookie-bar-container,
    [class*="privacy-notice"], [id*="privacy-notice"],
    [class*="consent-overlay"], [id*="consent-overlay"],
    #didomi-host, .didomi-popup-container,
    [id*="sp_message"], [class*="sp_message"],
    .evidon-notice-link, .evidon-banner,
    [class*="Cookiebot"], [id*="Cookiebot"],

    /* ── Newsletter / subscription popups ── */
    [class*="newsletter-popup"], [id*="newsletter-popup"],
    [class*="newsletter-modal"], [id*="newsletter-modal"],
    [class*="signup-popup"], [id*="signup-popup"],
    [class*="email-popup"], [id*="email-popup"],
    [class*="subscribe-popup"], [id*="subscribe-popup"],
    [class*="subscription-modal"], [id*="subscription-modal"],
    .mailchimp-popup, [class*="mc_embed_signup"][style*="fixed"],
    [class*="popup-overlay"], [id*="popup-overlay"],
    [class*="modal-overlay"][id*="newsletter"],
    [class*="exit-intent"], [id*="exit-intent"],

    /* ── Paywall / soft gate / subscribe walls ── */
    [class*="paywall"], [id*="paywall"],
    [class*="subscribe-wall"], [id*="subscribe-wall"],
    [class*="meter-wall"], [id*="meter-wall"],
    [class*="premium-gate"], [id*="premium-gate"],
    [class*="subscription-wall"], [id*="subscription-wall"],
    [class*="content-gate"], [id*="content-gate"],
    [class*="article-gate"], [id*="article-gate"],

    /* ── Banners (promotional / hero CTAs) ── */
    [class*="promo-banner"], [id*="promo-banner"],
    [class*="promotion-banner"], [id*="promotion-banner"],
    [class*="hero-banner"][class*="ad"], [class*="sticky-banner"],
    [class*="top-banner"][class*="promo"], [id*="site-banner-promo"],
    [class*="sale-banner"], [id*="sale-banner"],
    [class*="announcement-bar"], [id*="announcement-bar"],
    [class*="announcements-bar"], [id*="announcements-bar"],
    [class*="notification-bar"], [id*="notification-bar"],
    .notif-bar, #notif-bar, .alert-bar, #alert-bar,
    [class*="info-bar"][class*="promo"], [class*="ribbon-banner"],
    [class*="top-notice"], [id*="top-notice"],
    [class*="site-notice"], [id*="site-notice"],
    [class*="smart-bar"], [id*="smart-bar"], #HelloBar, .hello-bar,
    [class*="floating-bar"], [id*="floating-bar"],

    /* ── Support / donation blocks ── */
    [class*="support-box"], [id*="support-box"],
    [class*="support-block"], [id*="support-block"],
    [class*="donation-block"], [id*="donation-block"],
    [class*="patreon-widget"], [id*="patreon-widget"],
    [class*="ko-fi"], [id*="ko-fi"],
    [class*="buymeacoffee"], [id*="buymeacoffee"],
    [class*="opencollective"], [id*="opencollective"],
    [class*="support-cta"], [id*="support-cta"],
    [class*="support-footer"], [class*="donate-section"],
    [class*="fund-us"], [id*="fund-us"],

    /* ── Social media tracking widgets ── */
    [class*="fb-like"], [class*="fb-share"], [class*="fb-follow"],
    [class*="twitter-tweet"][data-width], .twitter-follow-button,
    [class*="instagram-media"], [class*="tiktok-embed"],
    [class*="linkedin-badge"], [class*="pinterest-widget"],
    .social-widget, [class*="social-embed"][class*="ad"],
    iframe[src*="facebook.com/plugins"], iframe[src*="platform.twitter.com"],
    iframe[src*="platform.linkedin.com"][class*="badge"],

    /* ── Self-promotion ── */
    [class*="self-promo"], [id*="self-promo"],
    [class*="cross-promote"], [id*="cross-promote"],
    [class*="related-products-ad"], [id*="related-products-ad"],
    [class*="upsell"], [id*="upsell"],

    /* ── Interstitials / fullscreen overlays ── */
    .interstitial-wrapper, [class*="interstitial"],
    [class*="fullscreen-ad"], [id*="fullscreen-ad"],
    [class*="ad-interstitial"], [id*="ad-interstitial"],
    .overlay-container[class*="ad"], .ad-overlay,

    /* ── Tracking pixels ── */
    img[src*="doubleclick.net"], img[src*="google-analytics.com"],
    img[src*="facebook.com/tr"], img[src*="amazon-adsystem.com"],
    img[width="1"][height="1"][src*="track"],
    img[width="0"][height="0"] { 
      display: none !important; 
      visibility: hidden !important; 
      pointer-events: none !important;
      opacity: 0 !important;
      position: absolute !important;
      left: -9999px !important;
      height: 0 !important;
      width: 0 !important;
      overflow: hidden !important;
    }
  \`;
  document.head.appendChild(s);
})();
`;

/** Remove cookie/GDPR banners via DOM mutation and unlock body scroll */
export const COOKIE_REMOVER_JS = `
(function() {
  const selectors = [
    '#onetrust-consent-sdk', '.onetrust-banner-sdk', '#onetrust-pc-sdk',
    '.onetrust-pc-dark-filter', '#onetrust-banner-sdk',
    '#cookie-banner', '.cookie-bar', '.cc-window', '.cc-banner',
    '[class*="cookie-consent"]', '[id*="cookie-consent"]',
    '[class*="cookie_consent"]', '[class*="cookie-law"]',
    '[class*="gdpr"]', '[id*="gdpr"]',
    '[class*="consent-banner"]', '[id*="consent-banner"]',
    '#qc-cmp2-container', '.qc-cmp-showing', '.fc-consent-root',
    '#fc-consent-root', '#CybotCookiebotDialog', '.CybotCookiebotFader',
    '#didomi-host', '.didomi-popup-container', '.evidon-banner',
    '.cc-overlay', '[class*="privacy-notice"]',
    '[id*="sp_message_container"]', '[class*="sp_message"]',
    '.cli-bar-container', '#wt-cli-cookie-bar-container',
    '[class*="Cookiebot"]', '[id*="Cookiebot"]',
  ];
  function clean() {
    selectors.forEach(sel => { try { document.querySelectorAll(sel).forEach(el => el.remove()); } catch {} });
    if (document.body) {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.height = '';
    }
    document.documentElement.style.overflow = '';
    document.documentElement.style.position = '';
    // Remove overflow:hidden added by overlay scripts
    ['body', 'html'].forEach(tag => {
      const el = document.querySelector(tag);
      if (el) {
        const cs = window.getComputedStyle(el);
        if (cs.overflow === 'hidden') el.style.overflow = '';
      }
    });
  }
  clean();
  setTimeout(clean, 800);
  setTimeout(clean, 2500);
  setTimeout(clean, 5000);
  // Mutation observer to catch dynamically injected banners
  const observer = new MutationObserver(() => clean());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
`;

/** Block analytics / tracking scripts from running */
export const TRACKING_BLOCK_JS = `
(function() {
  // Override Google Analytics
  window.ga = function() {};
  window.gtag = function() {};
  window._gaq = { push: function() {} };
  window.GoogleAnalyticsObject = 'ga';
  // Override Facebook Pixel
  window.fbq = function() {};
  window._fbq = function() {};
  // Override common analytics
  window.mixpanel = { track: function(){}, identify: function(){}, init: function(){} };
  window.analytics = { track: function(){}, page: function(){}, identify: function(){} };
  window.amplitude = { getInstance: function(){ return { logEvent: function(){} }; } };
  window.hj = function() {};
  window._hjSettings = {};
  window.Intercom = function() {};
  window.heap = { track: function(){}, identify: function(){} };
  window.dataLayer = window.dataLayer || [];
  // Prevent creation of ad iframes
  const origCreate = document.createElement.bind(document);
  document.createElement = function(tag) {
    const el = origCreate(tag);
    if (tag.toLowerCase() === 'script') {
      const origSetSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if (origSetSrc && origSetSrc.set) {
        const blocked = /(googlesyndication|doubleclick|googleadservices|taboola|outbrain|amazon-adsystem|hotjar|mixpanel|amplitude|segment|fullstory|mouseflow|crazyegg|clarity\\.ms|luckyorange|newrelic|cloudflareinsights)/i;
        Object.defineProperty(el, 'src', {
          set: function(v) { if (!blocked.test(v)) origSetSrc.set.call(this, v); },
          get: function() { return origSetSrc.get ? origSetSrc.get.call(this) : ''; },
          configurable: true
        });
      }
    }
    return el;
  };
})();
`;

/** Remove support/donation/promo blocks via DOM cleanup */
export const PROMO_BLOCK_REMOVER_JS = `
(function() {
  const textPatterns = [
    /support (us|this|the project|our work)/i,
    /buy me a (coffee|beer)/i,
    /become a (patron|sponsor)/i,
    /donate to/i,
    /sponsor this/i,
  ];
  function removeSupportBlocks() {
    const candidates = document.querySelectorAll('aside, .sidebar, section[class*="support"], div[class*="sponsor"], div[class*="donate"]');
    candidates.forEach(el => {
      const text = (el.textContent || '').trim();
      if (textPatterns.some(p => p.test(text)) && text.length < 500) {
        el.remove();
      }
    });
  }
  setTimeout(removeSupportBlocks, 1500);
  setTimeout(removeSupportBlocks, 4000);
})();
`;

/** Force responsive / mobile-friendly adaptive layout */
export const ADAPTIVE_LAYOUT_CSS = `
(function() {
  const s = document.createElement('style');
  s.id = '__dv_adaptive';
  s.textContent = \`
    /* ── Reset overflow / scrollability ── */
    html, body {
      max-width: 100vw !important;
      overflow-x: hidden !important;
      word-wrap: break-word !important;
      -webkit-text-size-adjust: 100% !important;
      text-size-adjust: 100% !important;
    }

    /* ── Images / media ── */
    img, video, embed, object, canvas, svg {
      max-width: 100% !important;
      height: auto !important;
    }
    iframe {
      max-width: 100% !important;
    }

    /* ── Code blocks ── */
    pre {
      white-space: pre-wrap !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      max-width: 100% !important;
      overflow-x: auto !important;
      padding: 12px !important;
      border-radius: 6px !important;
      font-size: 13px !important;
      line-height: 1.6 !important;
    }
    code {
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      white-space: pre-wrap !important;
      font-size: 13px !important;
    }
    pre code {
      white-space: pre-wrap !important;
    }

    /* ── Tables ── */
    table {
      display: block !important;
      overflow-x: auto !important;
      max-width: 100% !important;
      white-space: nowrap;
      -webkit-overflow-scrolling: touch !important;
    }
    th, td { min-width: 80px !important; }

    /* ── Sidebars and fixed-width columns ── */
    [class*="sidebar"], [id*="sidebar"], aside,
    [class*="col-xs-"], [class*="col-sm-"],
    [class*="col-md-"], [class*="col-lg-"] {
      float: none !important;
    }

    /* ── Remove fixed/sticky elements that eat screen space ── */
    [style*="position: fixed"], [style*="position:fixed"] {
      position: relative !important;
    }
    /* But keep top nav fixed if it's the header */
    header[style*="position: fixed"], nav[style*="position: fixed"] {
      position: sticky !important;
      top: 0 !important;
      z-index: 100 !important;
    }

    /* ── Improve text flow ── */
    p, li, dd, dt, blockquote {
      overflow-wrap: break-word !important;
      word-wrap: break-word !important;
      hyphens: auto !important;
    }

    /* ── Prevent horizontal scroll triggers ── */
    * { box-sizing: border-box !important; }
  \`;
  document.head.appendChild(s);
})();
`;

/** Reading mode — clean article layout with improved typography */
export const READING_MODE_CSS = `
(function() {
  const existing = document.getElementById('__dv_reading');
  if (existing) { existing.remove(); return '__dv_reading_off'; }
  
  // Try to extract the main article content
  const articleEl = 
    document.querySelector('article') ||
    document.querySelector('[class*="article-content"]') ||
    document.querySelector('[class*="post-content"]') ||
    document.querySelector('[class*="entry-content"]') ||
    document.querySelector('[class*="content-body"]') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('main') ||
    document.querySelector('#main') ||
    document.querySelector('.main') ||
    null;

  const s = document.createElement('style');
  s.id = '__dv_reading';
  s.textContent = \`
    /* Hide everything except article */
    body > *:not(#__dv_reading_wrap) {
      display: none !important;
    }
    #__dv_reading_wrap {
      display: block !important;
      max-width: 680px !important;
      margin: 0 auto !important;
      padding: 20px 18px 60px !important;
      font-family: -apple-system, 'Georgia', serif !important;
      font-size: 17px !important;
      line-height: 1.75 !important;
      color: inherit !important;
      background: inherit !important;
    }
    #__dv_reading_wrap h1 { font-size: 1.7em !important; margin-bottom: 0.4em !important; }
    #__dv_reading_wrap h2 { font-size: 1.35em !important; margin-top: 1.4em !important; }
    #__dv_reading_wrap h3 { font-size: 1.15em !important; margin-top: 1.2em !important; }
    #__dv_reading_wrap p  { margin-bottom: 1.1em !important; }
    #__dv_reading_wrap a  { text-decoration: underline !important; }
    #__dv_reading_wrap pre {
      font-size: 13px !important; padding: 14px !important;
      border-radius: 6px !important; overflow-x: auto !important;
      white-space: pre-wrap !important; word-break: break-word !important;
      background: rgba(128,128,128,0.12) !important;
    }
    #__dv_reading_wrap code {
      font-size: 13px !important;
      background: rgba(128,128,128,0.15) !important;
      padding: 1px 4px !important; border-radius: 3px !important;
    }
    #__dv_reading_wrap img {
      max-width: 100% !important; height: auto !important;
      display: block !important; margin: 1em auto !important;
      border-radius: 4px !important;
    }
    #__dv_reading_wrap blockquote {
      border-left: 3px solid #6366f1 !important;
      padding-left: 14px !important; margin-left: 0 !important;
      font-style: italic !important; color: inherit !important; opacity: 0.85 !important;
    }
    #__dv_reading_wrap table {
      display: block !important; overflow-x: auto !important;
      max-width: 100% !important; border-collapse: collapse !important;
    }
    #__dv_reading_wrap th, #__dv_reading_wrap td {
      padding: 6px 10px !important; border: 1px solid rgba(128,128,128,0.3) !important;
    }
  \`;
  document.head.appendChild(s);

  // Wrap article in reading container
  if (articleEl) {
    const wrap = document.createElement('div');
    wrap.id = '__dv_reading_wrap';
    document.body.innerHTML = '';
    document.body.appendChild(wrap);
    wrap.appendChild(articleEl.cloneNode(true));
  } else {
    // Fallback: wrap body content
    const wrap = document.createElement('div');
    wrap.id = '__dv_reading_wrap';
    const children = Array.from(document.body.children);
    children.forEach(c => { if (c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') wrap.appendChild(c.cloneNode(true)); });
    document.body.innerHTML = '';
    document.body.appendChild(wrap);
  }
  return '__dv_reading_on';
})();
`;

/** Per-source CSS overrides to clean up specific documentation sites */
export const SOURCE_CSS_OVERRIDES: Record<string, string> = {
  w3schools: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    #mySidenav, .sidenav, .w3-sidebar, #googleTop, #googleBottom,
    #ad_desktop_main, #ad_mobile_main, #tnb-google-top-ad-container,
    #tnb-google-bot-ad-container, .tnb-badge-link,
    .w3-right[style*="width:300"], #rightcolumn { display: none !important; }
    #main, .w3-main { margin-left: 0 !important; width: 100% !important; }
    .w3-row-padding { padding: 0 8px !important; }
    .w3-third, .w3-quarter, .w3-half { width: 100% !important; float: none !important; }
    .w3-col { width: 100% !important; float: none !important; }
    pre.w3-code { font-size: 13px !important; white-space: pre-wrap !important; }
  \`;
  document.head.appendChild(s);
})();`,

  mdn: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    .sidebar-container, aside.sidebar, .toc, .document-toc-container,
    .article-header-meta .on-github, .metadata, .prev-next,
    .newsletter-container, .mdn-cta-container, .place.top { display: none !important; }
    .main-wrapper, .article-container, main { max-width: 100% !important; margin: 0 !important; padding: 0 12px !important; }
    .article-actions-container { position: relative !important; }
    .section-content { max-width: 100% !important; }
  \`;
  document.head.appendChild(s);
})();`,

  devdocs: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    ._sidebar { width: 0 !important; overflow: hidden !important; transform: translateX(-100%) !important; }
    ._content { margin-left: 0 !important; }
    ._header { display: none !important; }
  \`;
  document.head.appendChild(s);
})();`,

  nextjs: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    nav[aria-label="site nav"], .nav-container, .feedback-widget { display: none !important; }
    article.docs, .article { max-width: 100% !important; padding: 0 12px !important; }
    .docs-sidebar { display: none !important; }
    .container { max-width: 100% !important; padding: 0 !important; }
  \`;
  document.head.appendChild(s);
})();`,

  tailwind: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    #sidebar, .sidebar, nav.fixed { display: none !important; }
    main, article, .content { max-width: 100% !important; margin-left: 0 !important; padding: 0 12px !important; }
  \`;
  document.head.appendChild(s);
})();`,

  reactnative: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    .docsNavContainer, nav.toc, .pluginDocSidebar, aside { display: none !important; }
    .docMainWrapper, main, article { max-width: 100% !important; margin-left: 0 !important; }
    .docExamples { flex-direction: column !important; }
  \`;
  document.head.appendChild(s);
})();`,

  stackoverflow: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    #sidebar, .everyonelovesstackoverflow, .s-sidebarwidget,
    .js-notice-container, .js-dismissable-hero, .js-flash-message,
    .site-footer, #footer, .community-bulletin,
    [data-component="s-banner"], .js-job-alert { display: none !important; }
    .content-wrapper, #content, .question-page { max-width: 100% !important; margin: 0 auto !important; }
    .mainbar { width: 100% !important; float: none !important; }
    .grid--cell.fl-shrink0 { display: none !important; }
  \`;
  document.head.appendChild(s);
})();`,

  github: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    .js-stale-session-flash, .js-notice, .signup-prompt,
    .marketing-header, .promo-banner { display: none !important; }
  \`;
  document.head.appendChild(s);
})();`,

  caniuse: `(function() {
  const s = document.createElement('style');
  s.textContent = \`
    .ad-block, #banner, #ad { display: none !important; }
    #main { max-width: 100% !important; padding: 0 8px !important; }
  \`;
  document.head.appendChild(s);
})();`,
};

/** Mobile User-Agent to use for all WebView requests */
export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

/**
 * Build the full injection script for a source.
 * Always injects: network block, viewport fix, ad-block CSS, cookie remover,
 * tracking block, adaptive layout CSS.
 * Adds per-source overrides when defined.
 */
export function buildInjection(sourceId: string, darkMode = false): string {
  const parts: string[] = [
    NETWORK_BLOCK_JS,
    VIEWPORT_FIX,
    AD_BLOCK_CSS,
    COOKIE_REMOVER_JS,
    TRACKING_BLOCK_JS,
    ADAPTIVE_LAYOUT_CSS,
    PROMO_BLOCK_REMOVER_JS,
  ];

  if (SOURCE_CSS_OVERRIDES[sourceId]) {
    parts.push(SOURCE_CSS_OVERRIDES[sourceId]);
  }

  return parts.join('\n');
}

/** Inject or remove reading mode — call via WebView.injectJavaScript() */
export function buildReadingModeToggle(): string {
  return READING_MODE_CSS;
}

/** Inject dark-mode override via filter (call via injectJavaScript when toggling) */
export const DARK_MODE_CSS = `
(function() {
  const id = '__dv_dark';
  const existing = document.getElementById(id);
  if (existing) { existing.remove(); return; }
  const s = document.createElement('style');
  s.id = id;
  s.textContent = \`
    html { filter: invert(0.9) hue-rotate(180deg) !important; }
    img, video, canvas, [class*="logo"], [class*="icon"], svg { filter: invert(1) hue-rotate(180deg) !important; }
    [class*="syntax"], [class*="highlight"], [class*="prism"], .hljs { filter: invert(1) hue-rotate(180deg) !important; }
  \`;
  document.head.appendChild(s);
})();
`;
