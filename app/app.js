// VICE COVER — one script owns every behaviour of the cover editor.
//
// The editor state lives in `state`. A single render function draws the
// cover into any canvas at any size, so the on-screen preview and the
// exported PNG are always the same picture.

(function () {
  'use strict';

  var canvas = document.getElementById('coverCanvas');
  var ctx = canvas.getContext('2d');
  var frame = document.getElementById('previewFrame');
  var zoomSlider = document.getElementById('zoomSlider');
  var zoomValue = document.getElementById('zoomValue');

  // -- layouts: each panel is a rectangle in fractions of the cover ----

  var GAP = 0.014;

  var LAYOUTS = {
    poster: function () {
      return [{ x: 0, y: 0, w: 1, h: 1 }];
    },
    grid: function () {
      var s = (1 - GAP) / 2;
      return [
        { x: 0, y: 0, w: s, h: s },
        { x: s + GAP, y: 0, w: s, h: s },
        { x: 0, y: s + GAP, w: s, h: s },
        { x: s + GAP, y: s + GAP, w: s, h: s },
      ];
    },
    strip: function () {
      return [
        { x: 0, y: 0, w: 1, h: 0.46 },
        { x: 0, y: 0.472, w: 1, h: 0.26 },
        { x: 0, y: 0.744, w: 1, h: 0.256 },
      ];
    },
    hero: function () {
      var s = (1 - GAP) / 2;
      return [
        { x: 0, y: 0, w: 0.66, h: 1 },
        { x: 0.674, y: 0, w: 0.326, h: s },
        { x: 0.674, y: s + GAP, w: 0.326, h: s },
      ];
    },
  };

  // -- colour grades: a canvas filter plus a translucent wash -----------

  var GRADES = {
    sunset: {
      filter: 'saturate(1.25) contrast(1.06)',
      top: 'rgba(255,45,149,0.08)',
      bottom: 'rgba(255,120,20,0.20)',
    },
    neon: {
      filter: 'saturate(1.45) contrast(1.08) hue-rotate(-12deg)',
      top: 'rgba(0,229,255,0.10)',
      bottom: 'rgba(140,40,255,0.20)',
    },
    golden: {
      filter: 'sepia(0.28) saturate(1.35) contrast(1.05)',
      top: 'rgba(255,214,90,0.06)',
      bottom: 'rgba(255,140,0,0.16)',
    },
    mono: {
      filter: 'grayscale(1) contrast(1.18) brightness(1.02)',
      top: 'rgba(255,255,255,0.00)',
      bottom: 'rgba(0,0,0,0.10)',
    },
  };

  // -- default framing for the Sunset Heist sample, per layout ----------
  // The sample already carries its own title in its lower half, so every
  // crop here frames the characters and skyline in the upper part.

  var HEIST_FRAMING = {
    poster: [{ zoom: 1.7, panX: 0, panY: -1 }],
    grid: [
      { zoom: 1.7, panX: 0, panY: -1 },
      { zoom: 2.2, panX: 1, panY: -0.6 },
      { zoom: 2.4, panX: -1, panY: -0.6 },
      { zoom: 2.4, panX: 0.7, panY: -0.7 },
    ],
    strip: [
      { zoom: 1.25, panX: 0, panY: -0.55 },
      { zoom: 1.7, panX: 0.5, panY: -0.35 },
      { zoom: 1.7, panX: -0.5, panY: -0.55 },
    ],
    hero: [
      { zoom: 1.7, panX: -0.15, panY: -1 },
      { zoom: 2.0, panX: 1, panY: -0.6 },
      { zoom: 2.0, panX: -1, panY: -1 },
    ],
  };

  // -- state ------------------------------------------------------------

  function freshPanels() {
    var panels = [];
    for (var i = 0; i < 4; i++) panels.push({ panX: 0, panY: 0, zoom: 1 });
    return panels;
  }

  var state = {
    photo: null,
    photoName: '',
    layout: 'poster',
    panels: freshPanels(),
    selected: 0,
    caption: 'SUNSET HEIST',
    subtitle: 'VICE CITY \u2022 EST. 2026',
    captionColor: '#ff2d95',
    grade: 'sunset',
  };

  function panelsOf() {
    return LAYOUTS[state.layout]();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // -- photo loading ----------------------------------------------------

  function applyFraming(name) {
    state.panels = freshPanels();
    var framing = name === 'heist' ? HEIST_FRAMING[state.layout] : null;
    if (!framing) return;
    for (var i = 0; i < framing.length && i < state.panels.length; i++) {
      state.panels[i] = {
        panX: framing[i].panX,
        panY: framing[i].panY,
        zoom: framing[i].zoom,
      };
    }
  }

  function loadPhotoFromUrl(url, framingName) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        state.photo = img;
        state.photoName = url;
        state.selected = 0;
        applyFraming(framingName || null);
        syncZoomControl();
        renderPreview();
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function loadPhotoFromFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      loadPhotoFromUrl(reader.result, null);
    };
    reader.readAsDataURL(file);
  }

  // -- rendering --------------------------------------------------------

  // Draws one panel: the photo clipped to the panel, scaled to cover it,
  // panned and zoomed per that panel's state.
  function drawPanel(c, img, rect, panel, grade) {
    var px = rect.x;
    var py = rect.y;
    var pw = rect.w;
    var ph = rect.h;
    c.save();
    c.beginPath();
    c.rect(px, py, pw, ph);
    c.clip();
    var scale = Math.max(pw / img.width, ph / img.height) * panel.zoom;
    var dw = img.width * scale;
    var dh = img.height * scale;
    var overX = dw - pw;
    var overY = dh - ph;
    var dx = px - overX * (0.5 + panel.panX / 2);
    var dy = py - overY * (0.5 + panel.panY / 2);
    c.filter = grade.filter;
    c.drawImage(img, dx, dy, dw, dh);
    c.filter = 'none';
    c.restore();
  }

  function drawCaption(c, w, h) {
    var text = state.caption.trim();
    if (!text) return;
    var size = Math.min(w * 0.105, h * 0.17);
    c.font = size + 'px Bungee, sans-serif';
    while (size > 12 && c.measureText(text).width > w * 0.92) {
      size -= 2;
      c.font = size + 'px Bungee, sans-serif';
    }
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.lineJoin = 'round';
    c.shadowColor = 'rgba(0,0,0,0.65)';
    c.shadowBlur = size * 0.14;
    c.shadowOffsetY = size * 0.045;
    c.lineWidth = size * 0.14;
    c.strokeStyle = 'rgba(8,0,18,0.9)';
    var y = h * 0.93;
    c.strokeText(text, w / 2, y);
    c.fillStyle = state.captionColor;
    c.fillText(text, w / 2, y);
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
  }

  function drawSubtitle(c, w, h) {
    var text = state.subtitle.trim();
    if (!text) return;
    var size = Math.min(w * 0.032, h * 0.05);
    c.font = '600 ' + size + 'px "Chakra Petch", sans-serif';
    try {
      c.letterSpacing = size * 0.32 + 'px';
    } catch (e) {
      // Older engines ignore letter spacing; the subtitle still draws.
    }
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.lineWidth = size * 0.22;
    c.strokeStyle = 'rgba(8,0,18,0.85)';
    var y = h * 0.975;
    c.strokeText(text, w / 2, y);
    c.fillStyle = '#ffffff';
    c.fillText(text, w / 2, y);
    try {
      c.letterSpacing = '0px';
    } catch (e) {
      // Ignore.
    }
  }

  // The one shared render: preview and export both come through here.
  function renderCoverInto(c, w, h, showSelection) {
    var grade = GRADES[state.grade];
    c.save();
    c.fillStyle = '#0a0512';
    c.fillRect(0, 0, w, h);
    var rects = panelsOf();
    if (state.photo) {
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        drawPanel(
          c,
          state.photo,
          { x: r.x * w, y: r.y * h, w: r.w * w, h: r.h * h },
          state.panels[i],
          grade
        );
      }
    } else {
      c.fillStyle = '#a894c4';
      c.font = '600 ' + Math.round(w * 0.03) + 'px "Chakra Petch", sans-serif';
      c.textAlign = 'center';
      c.fillText('Loading a photo\u2026', w / 2, h / 2);
    }
    // Colour grade wash.
    var wash = c.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, grade.top);
    wash.addColorStop(1, grade.bottom);
    c.fillStyle = wash;
    c.fillRect(0, 0, w, h);
    // Vignette.
    var vig = c.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    vig.addColorStop(0, 'rgba(5,0,15,0)');
    vig.addColorStop(1, 'rgba(5,0,15,0.34)');
    c.fillStyle = vig;
    c.fillRect(0, 0, w, h);
    drawCaption(c, w, h);
    drawSubtitle(c, w, h);
    // Thin dark frame around the whole cover.
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.lineWidth = Math.max(2, w * 0.006);
    c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, w - c.lineWidth, h - c.lineWidth);
    if (showSelection && state.photo) {
      var sel = rects[state.selected];
      if (sel) {
        c.strokeStyle = '#00e5ff';
        c.lineWidth = Math.max(2, w * 0.004);
        c.shadowColor = 'rgba(0,229,255,0.8)';
        c.shadowBlur = w * 0.01;
        c.strokeRect(sel.x * w, sel.y * h, sel.w * w, sel.h * h);
        c.shadowBlur = 0;
      }
    }
    c.restore();
  }

  function renderPreview() {
    renderCoverInto(ctx, canvas.width, canvas.height, true);
  }

  // Renders the cover at an export size and returns the canvas.
  function renderExport(width, height) {
    var out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    renderCoverInto(out.getContext('2d'), width, height, false);
    return out;
  }

  function downloadExport(width, height) {
    renderExport(width, height).toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'vice-cover-' + width + 'x' + height + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 5000);
    }, 'image/png');
  }

  // -- panel interaction -------------------------------------------------

  function panelAt(clientX, clientY) {
    var box = canvas.getBoundingClientRect();
    var fx = (clientX - box.left) / box.width;
    var fy = (clientY - box.top) / box.height;
    var rects = panelsOf();
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (fx >= r.x && fx < r.x + r.w && fy >= r.y && fy < r.y + r.h) return i;
    }
    return -1;
  }

  function panelOverflowPx(index) {
    if (!state.photo) return { x: 0, y: 0 };
    var r = panelsOf()[index];
    var pw = r.w * canvas.width;
    var ph = r.h * canvas.height;
    var panel = state.panels[index];
    var scale =
      Math.max(pw / state.photo.width, ph / state.photo.height) * panel.zoom;
    return {
      x: state.photo.width * scale - pw,
      y: state.photo.height * scale - ph,
    };
  }

  function syncZoomControl() {
    var zoom = state.panels[state.selected].zoom;
    zoomSlider.value = String(Math.round(zoom * 100));
    zoomValue.textContent = Math.round(zoom * 100) + '%';
  }

  function selectPanel(index) {
    if (index < 0 || index >= panelsOf().length) return;
    state.selected = index;
    syncZoomControl();
    renderPreview();
  }

  var dragging = null;

  canvas.addEventListener('pointerdown', function (event) {
    var index = panelAt(event.clientX, event.clientY);
    if (index < 0) return;
    selectPanel(index);
    canvas.setPointerCapture(event.pointerId);
    dragging = {
      index: index,
      startX: event.clientX,
      startY: event.clientY,
      panX: state.panels[index].panX,
      panY: state.panels[index].panY,
    };
  });

  canvas.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    var over = panelOverflowPx(dragging.index);
    var panel = state.panels[dragging.index];
    var box = canvas.getBoundingClientRect();
    var scaleX = canvas.width / box.width;
    var scaleY = canvas.height / box.height;
    var dx = (event.clientX - dragging.startX) * scaleX;
    var dy = (event.clientY - dragging.startY) * scaleY;
    if (over.x > 0) panel.panX = clamp(dragging.panX + (2 * dx) / over.x, -1, 1);
    if (over.y > 0) panel.panY = clamp(dragging.panY + (2 * dy) / over.y, -1, 1);
    renderPreview();
  });

  function endDrag() {
    dragging = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener(
    'wheel',
    function (event) {
      event.preventDefault();
      var index = panelAt(event.clientX, event.clientY);
      if (index < 0) return;
      selectPanel(index);
      var panel = state.panels[index];
      panel.zoom = clamp(panel.zoom * Math.exp(-event.deltaY * 0.0012), 1, 3);
      syncZoomControl();
      renderPreview();
    },
    { passive: false }
  );

  // -- control wiring -----------------------------------------------------

  function markActive(buttons, chosen) {
    buttons.forEach(function (b) {
      b.classList.toggle('active', b === chosen);
    });
  }

  var layoutButtons = Array.prototype.slice.call(
    document.querySelectorAll('.layout-btn')
  );
  layoutButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.layout = btn.getAttribute('data-layout');
      if (state.selected >= panelsOf().length) state.selected = 0;
      markActive(layoutButtons, btn);
      syncZoomControl();
      renderPreview();
    });
  });

  var sampleButtons = Array.prototype.slice.call(
    document.querySelectorAll('.sample-btn')
  );
  sampleButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      markActive(sampleButtons, btn);
      loadPhotoFromUrl(
        btn.getAttribute('data-sample'),
        btn.getAttribute('data-framing')
      );
    });
  });

  document.getElementById('photoInput').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (file) loadPhotoFromFile(file);
    e.target.value = '';
  });

  frame.addEventListener('dragenter', function (e) {
    e.preventDefault();
    frame.classList.add('dragging');
  });
  frame.addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  frame.addEventListener('dragleave', function (e) {
    e.preventDefault();
    frame.classList.remove('dragging');
  });
  frame.addEventListener('drop', function (e) {
    e.preventDefault();
    frame.classList.remove('dragging');
    var file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.indexOf('image/') === 0) loadPhotoFromFile(file);
  });

  document
    .getElementById('captionInput')
    .addEventListener('input', function (e) {
      state.caption = e.target.value;
      renderPreview();
    });

  document
    .getElementById('subtitleInput')
    .addEventListener('input', function (e) {
      state.subtitle = e.target.value;
      renderPreview();
    });

  var swatches = Array.prototype.slice.call(document.querySelectorAll('.swatch'));
  swatches.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.captionColor = btn.getAttribute('data-color');
      markActive(swatches, btn);
      renderPreview();
    });
  });

  var gradeButtons = Array.prototype.slice.call(
    document.querySelectorAll('.grade-btn')
  );
  gradeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.grade = btn.getAttribute('data-grade');
      markActive(gradeButtons, btn);
      renderPreview();
    });
  });

  zoomSlider.addEventListener('input', function () {
    var panel = state.panels[state.selected];
    panel.zoom = clamp(parseInt(zoomSlider.value, 10) / 100, 1, 3);
    zoomValue.textContent = zoomSlider.value + '%';
    renderPreview();
  });

  var exportButtons = Array.prototype.slice.call(
    document.querySelectorAll('.export-btn')
  );
  exportButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var parts = btn.getAttribute('data-export').split('x');
      downloadExport(parseInt(parts[0], 10), parseInt(parts[1], 10));
    });
  });

  // -- start ---------------------------------------------------------------

  loadPhotoFromUrl('samples/sunset-heist.jpg', 'heist');
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(renderPreview);
  }

  // Small automation hook used by the maker's own play-tests and
  // screenshot runs; it only drives the same UI state a person can set.
  window.VICECOVER = {
    state: state,
    loadSample: loadPhotoFromUrl,
    renderCover: renderExport,
    setPanel: function (index, panX, panY, zoom) {
      var panel = state.panels[index];
      if (!panel) return;
      panel.panX = clamp(panX, -1, 1);
      panel.panY = clamp(panY, -1, 1);
      panel.zoom = clamp(zoom, 1, 3);
      renderPreview();
    },
    setLayout: function (name) {
      var btn = document.querySelector('[data-layout="' + name + '"]');
      if (btn) btn.click();
    },
    setGrade: function (name) {
      var btn = document.querySelector('[data-grade="' + name + '"]');
      if (btn) btn.click();
    },
    setCaption: function (caption, subtitle) {
      var cap = document.getElementById('captionInput');
      var sub = document.getElementById('subtitleInput');
      cap.value = caption;
      sub.value = subtitle || '';
      state.caption = caption;
      state.subtitle = subtitle || '';
      renderPreview();
    },
  };
})();
