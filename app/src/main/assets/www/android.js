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


  /* --- bottom navigation ------------------------------------------------- */
  /* A drawer is a website pattern. On a phone the four things people actually
     come for — the text, search, the learning tools and the games — are each a
     tap away on a fixed bar instead of two taps behind a hamburger. The drawer
     stays for the corpus tree, which is genuinely hierarchical (3 அதிகாரம் ->
     27 இயல் -> 1,607 நூற்பா) and belongs in a tree, not a tab.

     Every destination is driven by clicking the portal's own .fitem elements
     (data-p keys: dir payiram about path test yappu oli games), so this never
     reimplements navigation — it just reaches the same handlers the sidebar
     uses, and keeps working if those pages change. */
  var NAV = [
    { id: 'read', label: 'படி',
      icon: '<path d="M12 6.6c-1.6-1.2-3.7-1.9-6.1-1.9H4.4v12h1.5c2.4 0 4.5.7 6.1 1.9 1.6-1.2 3.7-1.9 6.1-1.9h1.5v-12H18.1c-2.4 0-4.5.7-6.1 1.9z"/><path d="M12 6.6v11.9"/>' },
    { id: 'search', label: 'தேடு',
      icon: '<circle cx="11" cy="11" r="6"/><path d="M15.6 15.6 20 20"/>' },
    { id: 'learn', label: 'கற்க', page: 'path',
      icon: '<path d="M12 4.6 21 8.7l-9 4.1-9-4.1 9-4.1z"/><path d="M7 11.1v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4"/>' },
    { id: 'games', label: 'விளையாட்டு', page: 'games',
      icon: '<rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3.6"/><circle cx="9" cy="9" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.15" fill="currentColor" stroke="none"/>' }
  ];

  function goPage(key) {
    var item = qs('.fitem[data-p="' + key + '"]');
    if (item) { item.click(); return true; }
    if (typeof renderPage === 'function') { renderPage(key); return true; }
    return false;
  }

  /* Search is a mode, not a location: it changes no URL, so it is the one tab
     that has to be remembered rather than derived. Any real navigation clears it. */
  var forcedTab = null;
  /* The portal writes the hash but never listens to it — #a/i[/mn] for the text,
     #p/<key> for a front-matter page. Returning to the text therefore has to
     restore the fragment ourselves, or the bar keeps reporting the page we left. */
  var TEXT_HASH = /^#?\d+\/\d+(\/\d+)?$/;
  var lastTextHash = null;

  function rememberTextHash() {
    var h = window.location.hash || '';
    if (TEXT_HASH.test(h)) { lastTextHash = h.charAt(0) === '#' ? h : '#' + h; }
  }
  var LEARN_PAGES = ['path', 'test', 'yappu', 'oli'];
  /* The portal declares its game keys as `const GAMESET` inside its own script,
     which is script-scoped and NOT a window property — reading it from here
     throws ReferenceError, and a typeof guard just fails silently (the Games tab
     never lit up). Function declarations like renderPage/renderIyal/closeSide ARE
     global and are still called directly; only the const has to be mirrored.
     Keep in step with GAMESET in index.html. */
  var GAME_PAGES = ['games', 'game', 'sandhi', 'sort', 'chain', 'thinai',
                    'pairs', 'wordle', 'urubu', 'iyal', 'meyp'];

  function currentTab() {
    if (forcedTab) { return forcedTab; }
    /* The portal records front-matter pages in the hash as #p/<key> and the text
       as #<adhikaram>/<iyal>. cur.page stays null throughout, so the hash — not
       cur — is the source of truth for which tab is current. */
    var m = /^#?p\/(.+)$/.exec(window.location.hash || '');
    if (m) {
      var k = m[1];
      if (GAME_PAGES.indexOf(k) >= 0) { return 'games'; }
      if (LEARN_PAGES.indexOf(k) >= 0) { return 'learn'; }
    }
    return 'read';
  }

  function syncNav() {
    var bar = qs('.appnav');
    if (!bar) { return; }
    var active = currentTab();
    [].forEach.call(bar.children, function (b) {
      b.classList.toggle('on', b.dataset.nav === active);
      b.setAttribute('aria-current', b.dataset.nav === active ? 'page' : 'false');
    });
  }

  function buildBottomNav() {
    if (qs('.appnav')) { return; }
    var bar = document.createElement('nav');
    bar.className = 'appnav';
    bar.setAttribute('role', 'navigation');

    NAV.forEach(function (n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.nav = n.id;
      b.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + n.icon + '</svg>' +
        '<span>' + n.label + '</span>';
      b.addEventListener('click', function () {
        if (typeof closeSide === 'function') { closeSide(); }
        if (n.id === 'search') {
          forcedTab = 'search';
          var si = byId('search');
          if (si) { window.scrollTo(0, 0); si.focus(); si.select(); }
          syncNav();
          return;
        }
        forcedTab = null;
        if (n.id === 'read') {
          /* Leave whatever front-matter page is open and return to the text.
             replaceState rather than assigning location.hash: no extra history
             entry, and nothing in the portal is listening for the change. */
          try {
            history.replaceState(null, '',
              lastTextHash || (location.pathname + location.search));
          } catch (e) { /* a stale fragment is survivable; a crash is not */ }
          if (typeof renderTree === 'function') { renderTree(); }
          if (typeof renderIyal === 'function') { renderIyal(); }
          window.scrollTo(0, 0);
        } else {
          goPage(n.page);
        }
        document.documentElement.classList.add('nav-started');
        syncNav();
      });
      bar.appendChild(b);
    });

    document.body.appendChild(bar);
    rememberTextHash();
    document.documentElement.classList.add('has-appnav');
    syncNav();
    /* The sidebar and in-page links change the page without going through the
       bar, so re-derive the active tab after any navigation. */
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && !e.target.closest('.appnav, .search-wrap')) {
        forcedTab = null;
      }
      setTimeout(function () { rememberTextHash(); syncNav(); }, 60);
    }, true);
    window.addEventListener('hashchange', function () {
      forcedTab = null; rememberTextHash(); setTimeout(syncNav, 60);
    });
    /* Typing keeps you in search; clearing the box hands the tab back to the text. */
    var sIn = byId('search');
    if (sIn) {
      sIn.addEventListener('focus', function () { forcedTab = 'search'; syncNav(); });
      sIn.addEventListener('input', function () {
        forcedTab = sIn.value.trim().length ? 'search' : null;
        syncNav();
      });
    }
  }

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

    buildBottomNav();

    document.documentElement.classList.add('app-chrome-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrange, { once: true });
  } else {
    arrange();
  }
})();
