// Shows a plain message when the app never appears: its first script was blocked (a content blocker, a filtered
// network), is gone (a page kept from before a new release), or failed before anything was drawn. The app's own
// recovery lives inside that script, so it cannot help then; this file is separate and needs nothing else.
(function watchCeBoot() {
  var WAIT_AFTER_LOAD_MS = 12000;
  // Once the app's first script has run, the rest is still on its way and the app reports its own failures: a slow
  // connection gets this much longer before being told anything.
  var WAIT_WHILE_LOADING_MS = 45000;
  var AGENT_NOTE_ID = 'ce-agent-note';
  var waitedLonger = false;
  var NOTICE_ID = 'ce-boot-notice';
  // index.html's loading line: its bar is filled here from the sizes the build wrote on the page's file links.
  var LOADING_ID = 'ce-boot-loading';
  var SLOW_NOTE_MS = 15000;
  var timer = 0;
  var progressTimer = 0;

  // The app puts a few things in its root before it has drawn anything to see (the empty toast host, the loading
  // line); they carry this attribute, so a page holding only them still counts as not drawn.
  var appShown = function appShown() {
    var root = document.getElementById('root');
    if (!root) return false;
    for (var child = root.firstElementChild; child; child = child.nextElementSibling) {
      if (!child.hasAttribute('data-ce-boot-ignore')) return true;
    }
    return false;
  };

  var hide = function hide() {
    var notice = document.getElementById(NOTICE_ID);
    if (notice) notice.remove();
  };

  var stopLoading = function stopLoading() {
    window.clearInterval(progressTimer);
    var line = document.getElementById(LOADING_ID);
    if (line) line.remove();
  };

  // How much of the app's files has arrived, by size. The browser's own record of finished downloads is read, so
  // nothing is missed however early a file came.
  var showProgress = function showProgress() {
    var line = document.getElementById(LOADING_ID);
    var bar = line && line.querySelector('progress');
    if (!bar || !window.performance || !performance.getEntriesByType) return;
    var arrived = {};
    var entries = performance.getEntriesByType('resource');
    for (var i = 0; i < entries.length; i += 1) {
      if (entries[i].responseEnd > 0) arrived[entries[i].name] = true;
    }
    var files = document.querySelectorAll('[data-ce-bytes]');
    var total = 0;
    var done = 0;
    for (var j = 0; j < files.length; j += 1) {
      var bytes = Number(files[j].getAttribute('data-ce-bytes')) || 0;
      total += bytes;
      if (arrived[files[j].href || files[j].src]) done += bytes;
    }
    if (!total) return;
    bar.max = total;
    bar.value = done;
  };

  var reload = function reload() {
    // Ask for the page afresh first, so a copy kept from before a release is not what comes back.
    var gone = false;
    var go = function go() {
      if (gone) return;
      gone = true;
      window.location.reload();
    };
    // A stalled network must not leave the button doing nothing.
    window.setTimeout(go, 3000);
    try {
      window.fetch(window.location.href, { cache: 'reload', credentials: 'same-origin' }).then(go, go);
    } catch (_error) {
      go();
    }
  };

  var show = function show() {
    if (appShown() || document.getElementById(NOTICE_ID) || !document.body) return;
    // The off-screen note for AI agents, which the app's first script would have removed: not for people.
    var agentNote = document.getElementById(AGENT_NOTE_ID);
    if (agentNote) agentNote.remove();
    var notice = document.createElement('div');
    notice.id = NOTICE_ID;
    notice.setAttribute('role', 'alert');
    // System colours, so it reads in light and dark whatever else has loaded.
    notice.style.cssText =
      'position:fixed;top:0;right:0;bottom:0;left:0;overflow:auto;z-index:2147483000;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:16px;padding:24px;box-sizing:border-box;text-align:center;' +
      'font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color-scheme:light dark;' +
      'background:Canvas;color:CanvasText;';
    var title = document.createElement('p');
    title.textContent = 'This page did not load.';
    title.style.cssText = 'margin:0;font-size:20px;font-weight:600;';
    var help = document.createElement('p');
    help.textContent =
      'Check your connection and reload. If it still does not load, turn off any content blocker for this ' +
      'site, or try another browser or network.';
    help.style.cssText = 'margin:0;max-width:34em;';
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Reload';
    button.style.cssText =
      'min-height:44px;padding:8px 24px;font:inherit;font-weight:600;border:2px solid ButtonText;' +
      'border-radius:8px;background:ButtonFace;color:ButtonText;cursor:pointer;';
    button.addEventListener('click', reload);
    notice.appendChild(title);
    notice.appendChild(help);
    notice.appendChild(button);
    document.body.appendChild(notice);
  };

  var onWaitOver = function onWaitOver() {
    // The app's first script removes the agents' note as it starts, so a missing note means it ran.
    if (!waitedLonger && !document.getElementById(AGENT_NOTE_ID)) {
      waitedLonger = true;
      timer = window.setTimeout(show, WAIT_WHILE_LOADING_MS - WAIT_AFTER_LOAD_MS);
      return;
    }
    show();
  };

  var startTimer = function startTimer() {
    window.clearTimeout(timer);
    waitedLonger = false;
    timer = window.setTimeout(onWaitOver, WAIT_AFTER_LOAD_MS);
  };

  // The app's first script failing to load says so at once. Only a module script in the page counts: a failed
  // image, or a later part of the app (which is not a script element), is the app's to handle.
  window.addEventListener(
    'error',
    function onResourceError(event) {
      var target = event && event.target;
      if (target && target.tagName === 'SCRIPT' && target.getAttribute('type') === 'module') show();
    },
    true,
  );

  // Whatever else happens (a part of the page that never arrives also holds back the load event), nothing drawn
  // after the long wait is reported.
  window.setTimeout(show, WAIT_WHILE_LOADING_MS);

  // This script ran, so it speaks for a load that fails: the shell's own last sentence is for when it cannot.
  var dropShellMessage = function dropShellMessage() {
    var blocked = document.getElementById('ce-boot-blocked');
    if (blocked) blocked.remove();
  };
  if (document.getElementById(LOADING_ID)) dropShellMessage();
  else document.addEventListener('DOMContentLoaded', dropShellMessage);

  // The loading line: its bar moves as files arrive, and a slow load is told that it is slow, not broken.
  progressTimer = window.setInterval(showProgress, 300);
  window.setTimeout(function saySlow() {
    var note = document.getElementById(LOADING_ID + '-note');
    if (note && !appShown())
      note.textContent = 'This is taking longer than usual. A slow connection or a VPN can cause this.';
  }, SLOW_NOTE_MS);

  // Otherwise wait: the app draws well within this on a slow phone, and the message goes if it draws later.
  if (document.readyState === 'complete') startTimer();
  else window.addEventListener('load', startTimer);
  // A page brought back from the browser's memory starts the wait again.
  window.addEventListener('pageshow', function onPageShow(event) {
    if (event.persisted && !appShown()) startTimer();
  });

  var watchRoot = function watchRoot() {
    var root = document.getElementById('root');
    if (!root || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function onRootChange() {
      if (appShown()) {
        window.clearTimeout(timer);
        hide();
        stopLoading();
      }
    }).observe(root, { childList: true });
  };
  if (document.getElementById('root')) watchRoot();
  else document.addEventListener('DOMContentLoaded', watchRoot);
})();
