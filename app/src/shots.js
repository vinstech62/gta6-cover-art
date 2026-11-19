/* Vice City Cover Maker: screenshot mode.
 *
 * Read from the page query (?shot=cover&photo=boulevard&caption=...&size=
 * ...&layout=...&grade=...) and set the app up for a screenshot. Cover
 * mode hides the editor controls; editor mode shows them. When the font is
 * ready and two animation frames have painted, window.__ready is set so a
 * screenshot driver knows the page is settled.
 */

(function () {
  'use strict';

  var PHOTOS = {
    pier: 'samples/pier.jpg',
    boulevard: 'samples/boulevard.jpg'
  };

  function params() {
    var out = {};
    var query = window.location.search.replace(/^\?/, '');
    if (!query) return out;
    query.split('&').forEach(function (pair) {
      var parts = pair.split('=');
      if (parts.length === 2) {
        out[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1].replace(/\+/g, ' '));
      }
    });
    return out;
  }

  function loadPhotoIntoApp(src, done) {
    var app = window.ViceCityApp;
    if (!app) return done();
    var img = new Image();
    img.onload = function () {
      app.state.photos = [img, img, img];
      app.redraw();
      done();
    };
    img.onerror = function () {
      done();
    };
    img.src = src;
  }

  function applyQuery() {
    var q = params();
    var app = window.ViceCityApp;
    if (!app) return;
    var state = app.state;

    if (q.shot === 'cover') {
      document.body.classList.add('cover-mode');
    }

    if (q.caption) {
      state.caption = q.caption.slice(0, 40);
      var captionInput = document.getElementById('captionInput');
      if (captionInput) captionInput.value = state.caption;
    }

    if (q.size && /^\d+x\d+$/.test(q.size)) {
      state.size = q.size;
      var sizeSelect = document.getElementById('sizeSelect');
      if (sizeSelect) sizeSelect.value = q.size;
      app.applySize();
    }

    if (q.layout === 'classic' || q.layout === 'five-panel' || q.layout === 'full-bleed') {
      state.layout = q.layout;
      document.querySelectorAll('.layout-btn').forEach(function (button) {
        button.classList.toggle('active', button.getAttribute('data-layout') === q.layout);
      });
    }

    if (q.grade) {
      state.grade = q.grade;
      var gradeSelect = document.getElementById('gradeSelect');
      if (gradeSelect) gradeSelect.value = q.grade;
    }

    app.redraw();

    var photoSrc = PHOTOS[q.photo] || null;
    var photoDone = !photoSrc;
    if (photoSrc) {
      /* Wait for the app's own sample photo to finish first, so its load
       * cannot land after ours and swap the photo back. */
      var sampleTimer = window.setInterval(function () {
        var current = state.photos[0];
        if (current && current.complete) {
          window.clearInterval(sampleTimer);
          loadPhotoIntoApp(photoSrc, function () { photoDone = true; });
        }
      }, 50);
      window.setTimeout(function () {
        window.clearInterval(sampleTimer);
        if (!photoDone) {
          loadPhotoIntoApp(photoSrc, function () { photoDone = true; });
        }
      }, 5000);
    }

    var waited = 0;
    var fontsReady = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fontsReady = true; }).catch(function () { fontsReady = true; });
    } else {
      fontsReady = true;
    }

    var timer = window.setInterval(function () {
      waited += 50;
      var photo = state.photos[0];
      var photoLoaded = photoDone && photo && photo.complete && photo.naturalWidth > 0;
      if ((photoLoaded && fontsReady) || waited > 10000) {
        window.clearInterval(timer);
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            window.__ready = true;
          });
        });
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.setTimeout(applyQuery, 0);
    });
  } else {
    window.setTimeout(applyQuery, 0);
  }
})();
