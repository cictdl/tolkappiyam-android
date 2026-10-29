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


  /* --- recitation audio -------------------------------------------------- */
  /* 28 recordings bundled in assets/audio: பாயிரம் + one per இயல், 5.2 hours in
     all, served through the same WebViewAssetLoader origin as the page. They are
     per-இயல், not per-நூற்பா — no verse timestamps exist — so the player follows
     the இயல் you are reading and never pretends to know which line is being
     recited. Durations were measured from the MP3 frames at build time. */
  var AUDIO = {"payiram":{"f":"002-payiram","d":84,"by":"Prof. M. Vaidyalingan"},"iyal":[[{"f":"003-eluttu-noon-marabu","d":303,"by":"Prof. M. Vaidyalingan"},{"f":"004-eluttu-mozhi-marabu","d":528,"by":"Prof. Pramila Gurumurthy"},{"f":"005-eluttu-pirappiyal","d":265,"by":"Prof. M. Vaidyalingan"},{"f":"006-eluttu-punariyal","d":438},{"f":"007-eluttu-thokai-marabu","d":537},{"f":"008-eluttu-urubiyal","d":365},{"f":"009-eluttu-uyir-mayangiyal","d":827},{"f":"010-eluttu-pulli-mayangiyal","d":872},{"f":"011-eluttu-kutriyalugarap-punariyal","d":929}],[{"f":"012-col-kilaviyakkam","d":647},{"f":"013-col-vetrumaiyiyal","d":434},{"f":"014-col-vetrumai-mayangiyal","d":410},{"f":"015-col-vili-marabu","d":308},{"f":"016-col-peyariyal","d":583},{"f":"017-col-vinaiyiyal","d":659},{"f":"018-col-itaiyiyal","d":544},{"f":"019-col-uriyiyal","d":559},{"f":"020-col-ecchaviyal","d":718}],[{"f":"021-porul-akathinaiyiyal","d":685},{"f":"022-porul-purathinaiyiyal","d":1026},{"f":"023-porul-kalaviyal","d":970},{"f":"024-porul-karpiyal","d":1211},{"f":"025-porul-poruliyal","d":653},{"f":"026-porul-meyppaattiyal","d":378},{"f":"027-porul-uvamaviyal","d":363},{"f":"028-porul-cheyyuliyal","d":2135},{"f":"029-porul-marabiyal","d":1110}]]};
  var AUDIO_BASE = '../audio/';   /* /assets/www/index.html -> /assets/audio/ */
  var POS_KEY = 'tk_audio_pos';

  var ap = { el: null, bar: null, cur: null };

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }

  /* Which recording belongs to the current view — derived from the hash, the
     only state the portal exposes (see currentTab). */
  function audioFor() {
    var h = window.location.hash || '';
    if (/^#?p\/payiram$/.test(h)) {
      return { key: 'payiram', entry: AUDIO.payiram, label: 'சிறப்புப் பாயிரம்' };
    }
    var m = /^#?(\d+)\/(\d+)/.exec(h);
    if (m) {
      var a = +m[1], i = +m[2];
      if (AUDIO.iyal[a] && AUDIO.iyal[a][i]) {
        var h1 = qs('#main .iyal-head h1');
        var eyebrow = qs('#main .iyal-head .eyebrow');
        var adhi = eyebrow ? eyebrow.textContent.split('\u00b7')[0].trim() : '';
        return { key: a + '/' + i, entry: AUDIO.iyal[a][i],
                 label: (adhi ? adhi + ' \u00b7 ' : '') + (h1 ? h1.textContent.trim() : '') };
      }
    }
    return null;
  }

  function ensurePlayer() {
    if (ap.el) { return; }
    var el = document.createElement('audio');
    el.preload = 'metadata';
    el.setAttribute('playsinline', '');
    ap.el = el;

    var bar = document.createElement('div');
    bar.className = 'apl';
    bar.innerHTML =
      '<button class="apl-play" type="button" aria-label="play">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-play" d="M8 5.5v13l11-6.5z"/>' +
        '<path class="i-pause" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button>' +
      '<div class="apl-mid"><div class="apl-title"></div>' +
        '<input class="apl-seek" type="range" min="0" max="1000" value="0" aria-label="seek">' +
        '<div class="apl-time"><span class="apl-cur">0:00</span><span class="apl-by"></span>' +
        '<span class="apl-dur">0:00</span></div></div>' +
      '<button class="apl-mark" type="button">குறி</button>' +
      '<button class="apl-export" type="button" aria-label="export">ஏற்றுமதி</button>' +
      '<button class="apl-close" type="button" aria-label="close">\u00d7</button>';
    bar.appendChild(el);            /* in the DOM: inspectable, and GC-safe */
    document.body.appendChild(bar);
    ap.bar = bar;

    bar.querySelector('.apl-mark').addEventListener('click', function () {
      marking = !marking; updateMarkUi(); decorateCards();
    });
    bar.querySelector('.apl-export').addEventListener('click', exportCues);
    var playBtn = bar.querySelector('.apl-play');
    var seek = bar.querySelector('.apl-seek');
    playBtn.addEventListener('click', function () { if (el.paused) { el.play(); } else { el.pause(); } });
    bar.querySelector('.apl-close').addEventListener('click', function () {
      el.pause(); el.removeAttribute('src'); el.load(); ap.cur = null; clearLit();
      marking = false; updateMarkUi();
      document.documentElement.classList.remove('has-apl'); refreshRows();
    });
    var scrubbing = false;
    seek.addEventListener('input', function () {
      scrubbing = true;
      bar.querySelector('.apl-cur').textContent = fmt(seek.value / 1000 * (el.duration || 0));
    });
    seek.addEventListener('change', function () {
      if (el.duration) { el.currentTime = seek.value / 1000 * el.duration; }
      scrubbing = false;
    });
    el.addEventListener('timeupdate', function () {
      followCues();
      if (!scrubbing && el.duration) { seek.value = Math.round(el.currentTime / el.duration * 1000); }
      bar.querySelector('.apl-cur').textContent = fmt(el.currentTime);
      if (ap.cur && Math.floor(el.currentTime) % 5 === 0) {
        try { localStorage.setItem(POS_KEY, JSON.stringify({ k: ap.cur, t: el.currentTime })); } catch (e) {}
      }
    });
    el.addEventListener('loadedmetadata', function () {
      bar.querySelector('.apl-dur').textContent = fmt(el.duration);
    });
    ['play', 'pause', 'ended'].forEach(function (ev) {
      el.addEventListener(ev, function () {
        bar.classList.toggle('playing', !el.paused && !el.ended);
        if (el.paused || el.ended) { clearLit(); }
        refreshRows(); decorateCards();
      });
    });
    /* The portal's own read-aloud (TTS) and this player must never talk over
       each other: starting either one silences the other. */
    el.addEventListener('play', function () { if (typeof stopSpeak === 'function') { stopSpeak(); } });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('[data-act="tts"]')) { el.pause(); }
    }, true);

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', function () { el.play(); });
        navigator.mediaSession.setActionHandler('pause', function () { el.pause(); });
        navigator.mediaSession.setActionHandler('seekbackward', function () {
          el.currentTime = Math.max(0, el.currentTime - 15); });
        navigator.mediaSession.setActionHandler('seekforward', function () {
          el.currentTime = Math.min(el.duration || 0, el.currentTime + 30); });
      } catch (e) {}
    }
  }

  function loadTrack(info, autoplay) {
    ensurePlayer();
    var el = ap.el;
    if (ap.cur === info.key) {
      if (autoplay) { if (el.paused) { el.play(); } else { el.pause(); } }
      return;
    }
    ap.cur = info.key;
    el.src = AUDIO_BASE + info.entry.f + '.mp3';
    ap.bar.querySelector('.apl-title').textContent = info.label;
    ap.bar.querySelector('.apl-by').textContent = info.entry.by || '';
    ap.bar.querySelector('.apl-dur').textContent = fmt(info.entry.d);
    ap.bar.querySelector('.apl-seek').value = 0;
    document.documentElement.classList.add('has-apl');
    try {
      var saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (saved && saved.k === info.key && saved.t > 5 && saved.t < info.entry.d - 5) {
        el.addEventListener('loadedmetadata', function once() {
          el.removeEventListener('loadedmetadata', once);
          el.currentTime = saved.t;
        });
      }
    } catch (e) {}
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: info.label, artist: info.entry.by || 'CICT', album: 'தொல்காப்பிய நுண்ணறிவு' });
      } catch (e) {}
    }
    if (autoplay) { var pr = el.play(); if (pr && pr.catch) { pr.catch(function () {}); } }
    refreshRows();
  }

  /* The ▶ row on the இயல் / பாயிரம் header. renderIyal() replaces #main
     wholesale, so this is re-applied from a MutationObserver, not once. */
  function refreshRows() {
    var info = audioFor();
    var old = qs('#main .iyal-audio');
    if (!info) { if (old) { old.remove(); } return; }
    var row = old || document.createElement('div');
    row.className = 'iyal-audio';
    var isCur = ap.cur === info.key;
    var playing = isCur && ap.el && !ap.el.paused;
    row.innerHTML =
      '<button type="button" class="iyal-audio-btn' + (playing ? ' on' : '') + '">' +
        (playing ? '\u23f8' : '\u25b6') + ' இயல் ஒலி' +
        ' <span class="iyal-audio-d">' + fmt(info.entry.d) + '</span></button>' +
      (info.entry.by ? '<span class="iyal-audio-by">' + info.entry.by + '</span>' : '');
    row.querySelector('button').onclick = function () { loadTrack(info, true); };
    if (!old) {
      var head = qs('#main .iyal-head');
      var nav = head && head.querySelector('.iyal-nav');
      if (head && nav) { head.insertBefore(row, nav); }
      else if (head) { head.appendChild(row); }
      else {
        var h1 = qs('#main h1');
        if (h1 && h1.parentNode) { h1.parentNode.insertBefore(row, h1.nextSibling); }
      }
    }
  }


  /* --- நூற்பா highlighting: cue sheets --------------------------------- */
  /* A cue sheet maps a recording to verse start times:
       cues[fileStem] = [[mn, seconds], ...]   (mn = the portal's 1-based index)
     Automatic alignment was tried and rejected: the reciter pauses between அடி
     as long as between நூற்பா (கிளவியாக்கம்: 61 நூற்பா, 137 அடி, pause counts
     tracked the lines), so a cumulative guess drifts after one miss. Cues are
     therefore made by a listener in the app's marking mode and shipped in
     assets/audio/cues.json; ones marked on this device take effect at once
     from localStorage. With no cues for a recording, nothing is highlighted —
     the app never pretends to know which verse is being recited. */
  var CUES_KEY = 'tk_audio_cues';
  var cues = {};            /* merged: shipped file, then local marks on top */
  var marking = false;

  function loadCues() {
    try {
      var local = JSON.parse(localStorage.getItem(CUES_KEY) || '{}');
      for (var k in local) { cues[k] = local[k]; }
    } catch (e) {}
    try {
      fetch(AUDIO_BASE + 'cues.json').then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (shipped) {
          for (var k in shipped) { if (!cues[k] || !cues[k].length) { cues[k] = shipped[k]; } }
        }).catch(function () {});
    } catch (e) {}
  }

  function cueList() {
    if (!ap.cur) { return null; }
    var info = audioFor();
    var stem = (info && info.key === ap.cur) ? info.entry.f : null;
    if (!stem) {
      /* Playing one இயல் while reading another: no highlight — the cards on
         screen are not the ones being recited. */
      return null;
    }
    var list = cues[stem];
    return (list && list.length) ? list.slice().sort(function (a, b) { return a[1] - b[1]; }) : null;
  }

  function cardFor(mn) {
    var m = /^#?(\d+)\/(\d+)/.exec(window.location.hash || '');
    return m ? byId('n-' + m[1] + '-' + m[2] + '-' + mn) : null;
  }

  var lastLit = null;
  function clearLit() {
    if (lastLit) { lastLit.classList.remove('reciting'); lastLit = null; }
  }

  function followCues() {
    var list = cueList();
    if (!list || !ap.el || ap.el.paused) { return; }
    var t = ap.el.currentTime, mn = null;
    for (var i = 0; i < list.length; i++) { if (list[i][1] <= t) { mn = list[i][0]; } else { break; } }
    if (mn === null) { clearLit(); return; }
    var card = cardFor(mn);
    if (card === lastLit) { return; }
    clearLit();
    if (card) {
      card.classList.add('reciting'); lastLit = card;
      var r = card.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 140) {
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }

  function seekToCard(mn) {
    var info = audioFor();
    if (!info) { return; }
    var list = cues[info.entry.f];
    var at = null;
    if (list) { for (var i = 0; i < list.length; i++) { if (list[i][0] === mn) { at = list[i][1]; } } }
    loadTrack(info, false);
    var el = ap.el;
    var go = function () {
      if (at !== null) { el.currentTime = at; }
      var pr = el.play(); if (pr && pr.catch) { pr.catch(function () {}); }
    };
    if (el.readyState >= 1) { go(); }
    else { el.addEventListener('loadedmetadata', function once() { el.removeEventListener('loadedmetadata', once); go(); }); }
  }

  /* ---- marking mode: the listener builds the cue sheet in the app ---- */
  function markCard(mn) {
    var info = audioFor();
    if (!info || !ap.el || ap.cur !== info.key) { return; }
    var stem = info.entry.f, t = Math.round(ap.el.currentTime * 10) / 10;
    var list = (cues[stem] || []).filter(function (c) { return c[0] !== mn; });
    list.push([mn, t]);
    list.sort(function (a, b) { return a[0] - b[0]; });
    cues[stem] = list;
    try {
      var local = JSON.parse(localStorage.getItem(CUES_KEY) || '{}');
      local[stem] = list; localStorage.setItem(CUES_KEY, JSON.stringify(local));
    } catch (e) {}
    var card = cardFor(mn);
    if (card) { card.classList.add('marked'); }
    updateMarkUi(); decorateCards();
  }

  function updateMarkUi() {
    var b = ap.bar && ap.bar.querySelector('.apl-mark');
    if (!b) { return; }
    var info = audioFor();
    var total = 0, done = 0;
    if (info) {
      total = document.querySelectorAll('#main .nurpa').length;
      done = (cues[info.entry.f] || []).length;
    }
    b.textContent = marking ? ('குறி ' + done + '/' + total) : 'குறி';
    b.classList.toggle('on', marking);
    document.documentElement.classList.toggle('marking', marking);
  }

  function exportCues() {
    var local = {};
    try { local = JSON.parse(localStorage.getItem(CUES_KEY) || '{}'); } catch (e) {}
    var text = JSON.stringify(local);
    var title = 'tolkappiyam cues';
    if (navigator.share) {
      navigator.share({ title: title, text: text }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      window.prompt(title, text);
    }
  }

  /* ---- per-card ▶ and the TTS highlight ---- */
  function decorateCards() {
    var info = audioFor();
    [].forEach.call(document.querySelectorAll('#main .nurpa'), function (card) {
      var tools = card.querySelector('.card-tools');
      if (!tools) { return; }
      var mn = +card.id.split('-').pop();
      var btn = tools.querySelector('.rec-btn');
      if (!info) { if (btn) { btn.remove(); } return; }
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'ct-btn rec-btn';
        btn.setAttribute('aria-label', 'recitation');
        btn.textContent = '\u25b6';
        tools.insertBefore(btn, tools.firstChild);
      }
      var list = cues[info.entry.f];
      var has = list && list.some(function (c) { return c[0] === mn; });
      btn.classList.toggle('cued', !!has);
      card.classList.toggle('marked', !!has && marking);
      btn.onclick = function () {
        if (marking) { markCard(mn); return; }
        seekToCard(mn);
      };
    });
  }

  function setupHighlight() {
    loadCues();
    var main = byId('main');
    if (main) {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { decorateCards(); updateMarkUi(); }, 50); })
        .observe(main, { childList: true });
    }
    decorateCards();

    /* Your literal request on the path that works today: when a card's own
       🔊 read-aloud is speaking, that card is lit. The portal only lights the
       button (curBtn.on); mirror it onto the card and clear when speech ends. */
    var ttsCard = null, ttsPoll = null;
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-act="tts"]');
      if (!b) { return; }
      var card = b.closest('.nurpa');
      setTimeout(function () {
        var on = b.classList.contains('on');
        if (ttsCard) { ttsCard.classList.remove('reciting'); ttsCard = null; }
        if (on && card) { ttsCard = card; card.classList.add('reciting'); }
        clearInterval(ttsPoll);
        if (on) {
          ttsPoll = setInterval(function () {
            if (!b.classList.contains('on') || !(window.speechSynthesis && speechSynthesis.speaking)) {
              clearInterval(ttsPoll);
              if (ttsCard) { ttsCard.classList.remove('reciting'); ttsCard = null; }
            }
          }, 400);
        }
      }, 80);
    }, false);
  }

  function setupAudio() {
    var main = byId('main');
    if (!main) { return; }
    var pending = null;
    new MutationObserver(function () {
      clearTimeout(pending); pending = setTimeout(refreshRows, 40);
    }).observe(main, { childList: true });
    window.addEventListener('hashchange', function () { setTimeout(function () { refreshRows(); decorateCards(); }, 60); });
    refreshRows();
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
    setupAudio();
    setupHighlight();

    document.documentElement.classList.add('app-chrome-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrange, { once: true });
  } else {
    arrange();
  }
})();
