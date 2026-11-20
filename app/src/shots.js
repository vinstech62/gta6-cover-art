/* Vice City Cover Maker - screenshot mode.
 *
 * Reads the page query (?shot=cover&photo=pier&caption=...&size=...&
 * layout=...&grade=...), arranges the app accordingly, and sets
 * window.__ready once the requested photo is in, the fonts are ready
 * and two animation frames have painted, so an automated driver can
 * capture deterministic screenshots of covers and of the editor.
 *
 * Classic script; runs after src/main.js and drives window.ViceCityApp.
 */
(function () {
  'use strict';

  var PHOTO_SOURCES = {
    pier: 'samples/pier.jpg',
    boulevard: 'samples/boulevard.jpg'
  };
  var LAYOUTS = ['classic', 'five-panel', 'full-bleed'];
  var READY_TIMEOUT_MS = 10000;
  var SAMPLE_WAIT_MS = 4000;

  function parseQuery() {
    var params = {};
    var search = window.location.search.replace(/^\?/, '');
    if (!search) return params;
    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      if (!pair) continue;
      var idx = pair.indexOf('=');
      var key = idx === -1 ? pair : pair.slice(0, idx);
      var value = idx === -1 ? '' : pair.slice(idx + 1);
      try {
        params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
      } catch (err) {
        /* skip malformed pair */
      }
    }
    return params;
  }

  function markReady() {
    if (window.__ready) return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        window.__ready = true;
      });
    });
  }

  function run() {
    var params = parseQuery();
    var app = window.ViceCityApp;
    var state = app.state;
    var startedAt = Date.now();
    var fontsReady = false;
    var photoReady = !params.photo; /* nothing requested: sample is fine */

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fontsReady = true; }, function () { fontsReady = true; });
    } else {
      fontsReady = true;
    }

    if (params.shot === 'cover') {
      document.body.classList.add('cover-mode');
    }

    if (typeof params.caption === 'string') {
      var caption = params.caption.slice(0, 40);
      var captionInput = document.getElementById('captionInput');
      if (captionInput) captionInput.value = caption;
      state.caption = caption.trim() === '' ? 'VICE CITY' : caption;
    }

    if (typeof params.size === 'string' && /^\d+x\d+$/.test(params.size)) {
      state.size = params.size;
      var sizeSelect = document.getElementById('sizeSelect');
      if (sizeSelect) sizeSelect.value = params.size;
      app.applySize();
    }

    if (params.layout && LAYOUTS.indexOf(params.layout) !== -1) {
      state.layout = params.layout;
      var buttons = document.querySelectorAll('.layout-btn');
      Array.prototype.forEach.call(buttons, function (button) {
        if (button.getAttribute('data-layout') === params.layout) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
    }

    if (params.grade && window.ViceCoverGrades &&
        Object.prototype.hasOwnProperty.call(window.ViceCoverGrades, params.grade)) {
      state.grade = params.grade;
      var gradeSelect = document.getElementById('gradeSelect');
      if (gradeSelect) gradeSelect.value = params.grade;
    }

    app.redraw();

    function loadRequestedPhoto() {
      var src = PHOTO_SOURCES[params.photo];
      var img = new Image();
      img.onload = function () {
        state.photos = [img, img, img];
        app.redraw();
        photoReady = true;
      };
      img.onerror = function () {
        photoReady = true;
      };
      img.src = src;
    }

    if (params.photo && PHOTO_SOURCES[params.photo]) {
      /* Wait for the app's own sample photo to settle first, so its
       * load handler cannot overwrite the requested photo afterwards. */
      var samplePoll = window.setInterval(function () {
        var current = state.photos && state.photos[0];
        var settled = current && current.complete && current.naturalWidth > 0;
        if (settled || Date.now() - startedAt > SAMPLE_WAIT_MS) {
          window.clearInterval(samplePoll);
          loadRequestedPhoto();
        }
      }, 50);
    }

    var gate = window.setInterval(function () {
      var timedOut = Date.now() - startedAt > READY_TIMEOUT_MS;
      var sample = state.photos && state.photos[0];
      var sampleIn = !params.photo
        ? !!(sample && sample.complete && sample.naturalWidth > 0)
        : photoReady;
      if ((photoReady && sampleIn && fontsReady) || timedOut) {
        window.clearInterval(gate);
        markReady();
      }
    }, 50);
  }

  function whenBooted() {
    if (window.ViceCityApp && window.ViceCityApp.isBooted()) {
      run();
      return;
    }
    window.setTimeout(whenBooted, 50);
  }

  if (window.location.search) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', whenBooted);
    } else {
      whenBooted();
    }
  }
})();
