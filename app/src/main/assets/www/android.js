/* ===========================================================================
   android.js — app-only chrome. Ships only inside the APK.

   Moves the government strip, the institution identity and the corpus counts
   out of the sticky masthead. android.css has already hidden them at their old
   positions, so this runs without any visible reflow.

   Every step is defensive: if the portal's markup changes and an element is
   missing, that step is skipped and the rest still applies. The app must never
   be bricked by a chrome tweak.
   =========================================================================== */
(function () {
  'use strict';

  /* --- neutralise the service worker inside the app -------------------- */
  /* The portal's service worker is cache-first over 'tk-portal-v1'. On the web
     that is what makes it work offline. Inside the APK every asset is already
     local, so the worker buys nothing — and its cache lives in the WebView data
     directory, which SURVIVES an app update. Ship a new portal in a new APK and
     the stale cache would keep serving the old one. So: unregister, drop the
     caches, and stop the page's own registration call from taking effect.
     This runs deferred, i.e. before the portal's window 'load' handler. */
  function disableServiceWorker() {
    if (!('serviceWorker' in navigator)) { return; }
    try {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { r.unregister(); });
      }).catch(function () {});
      if (window.caches && caches.keys) {
        caches.keys().then(function (keys) {
          keys.forEach(function (k) { caches.delete(k); });
        }).catch(function () {});
      }
      navigator.serviceWorker.register = function () {
        return Promise.reject(new Error('service worker disabled in app build'));
      };
    } catch (e) { /* never let this stop the app from starting */ }
  }
  disableServiceWorker();

  /* --- follow the device dark mode ------------------------------------- */
  /* The portal ships a full dark palette and 14 html[data-theme="dark"] rule
     blocks, but no code anywhere sets that attribute and there is no toggle in
     the UI — the dark theme is written and unreachable. In an app that matters
     more than on the web: the Android theme is DayNight, so on a dark-mode phone
     a dark system bar sat directly above a cream page. Honour the device setting
     using the palette the designer already wrote. Runs during defer, before
     first paint, so there is no light flash. Nothing else writes data-theme, so
     there is no user preference here to override. */
  function followSystemTheme() {
    if (!window.matchMedia) { return; }
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var apply = function (m) {
        if (m.matches) { document.documentElement.setAttribute('data-theme', 'dark'); }
        else { document.documentElement.removeAttribute('data-theme'); }
      };
      apply(mq);
      if (mq.addEventListener) { mq.addEventListener('change', apply); }
      else if (mq.addListener) { mq.addListener(apply); }
    } catch (e) { /* a themed app is nice; a running app is mandatory */ }
  }
  followSystemTheme();

  function byId(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelector(sel); }

  function arrange() {
    var mastIn = qs('header.mast .mast-in');
    var side = byId('side');

    /* --- app bar title -------------------------------------------------- */
    /* The institution names are leaving the bar, so give it a short title.
       Taken from <title> so it stays correct if the portal is re-branded. */
    if (mastIn && !qs('.app-title')) {
      var title = document.createElement('div');
      title.className = 'app-title';
      /* The app is published as தொல்காப்பிய நுண்ணறிவு, while <title> still names
         the underlying portal edition. The bar shows the app name so it agrees
         with the launcher label. Keep in step with app_name in strings.xml. */
      title.textContent = 'தொல்காப்பிய நுண்ணறிவு';
      var logo = mastIn.querySelector('.logo');
      if (logo && logo.nextSibling) { mastIn.insertBefore(title, logo.nextSibling); }
      else { mastIn.appendChild(title); }
    }

    /* --- language toggle stays in the bar -------------------------------- */
    /* It is a reading control, not branding, so it must not travel to the
       drawer with the rest of .mast-right. Move it out before that block goes. */
    var langBtn = byId('langBtn');
    if (langBtn && mastIn && langBtn.parentElement !== mastIn) {
      mastIn.appendChild(langBtn);
    }

    /* --- institution identity + outbound links -> drawer header ---------- */
    if (side) {
      var mastT = qs('header.mast .mast-t');
      var mastRight = qs('header.mast .mast-right');
      if (mastT || mastRight) {
        var ident = document.createElement('div');
        ident.className = 'app-ident';
        if (mastT) { ident.appendChild(mastT); }
        if (mastRight) { ident.appendChild(mastRight); }
        side.insertBefore(ident, side.firstChild);
      }

      /* --- Government of India strip -> drawer footer -------------------- */
      /* Relocated, never removed: CICT is an autonomous institution under the
         Ministry of Education and the attribution has to remain in the app. */
      var gov = qs('header.mast .gov-strip') || qs('.gov-strip');
      if (gov) {
        var foot = document.createElement('div');
        foot.className = 'app-govfoot';
        foot.appendChild(gov);
        side.appendChild(foot);
      }
    }

    /* --- search out of the drawer, into the app bar ---------------------- */
    /* On the web the sidebar is always on screen, so a search box inside it is
       fine. On a phone the sidebar is a drawer over the page: you must open it
       to reach the box, results render into #main behind it, and the scrim then
       covers them — so a perfectly good search looks broken. Lift the box into
       the header, where it is always reachable and never covers its own results. */
    var searchWrap = qs('#side > .search-wrap') || qs('.search-wrap');
    var mast = qs('header.mast');
    if (searchWrap && mast) {
      var tri = mast.querySelector('.tricolour');
      if (tri && tri.nextSibling) { mast.insertBefore(searchWrap, tri.nextSibling); }
      else { mast.appendChild(searchWrap); }
    }

    /* Belt and braces: if a search ever runs while the drawer is open, get the
       drawer out of the way so the results are actually visible. */
    var si = byId('search');
    if (si) {
      si.addEventListener('input', function () {
        if (si.value.trim().length >= 2 && typeof closeSide === 'function') {
          var sd = byId('side');
          if (sd && sd.classList.contains('open')) { closeSide(); }
        }
      });
    }

    /* --- corpus counts -> home screen, out of the sticky header ---------- */
    var subbar = qs('header.mast .subbar');
    var hero = qs('.hero');
    if (subbar && hero) { hero.appendChild(subbar); }

    /* --- the hero is a landing element, not a page header ---------------- */
    /* .hero sits above .shell in the document, so its 299px of title, quote and
       counts reappear above every nuṟpā the reader opens — 37% of a phone screen
       spent on decoration while reading. Show it on arrival, retire it the moment
       the reader navigates. Bound to real navigation intent (a click in the tree,
       the front nav or the counts) rather than to a scroll or content heuristic,
       so it can never hide while the reader is still on the landing view. */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('#tree, .frontnav, .subbar, .fitem')) {
        document.documentElement.classList.add('nav-started');
      }
    }, true);

    document.documentElement.classList.add('app-chrome-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrange, { once: true });
  } else {
    arrange();
  }
})();
