/* VICE COVER — the whole editor in one script.
   One shared renderCover() draws the poster for the on-screen preview and
   for every PNG export, so what you see is exactly what you get. */

(function () {
  "use strict";

  /* ---------- layout definitions (fractions of the cover) ---------- */

  var LAYOUTS = {
    POSTER: [[0, 0, 1, 1]],
    GRID: [
      [0, 0, 0.494, 0.494],
      [0.506, 0, 0.494, 0.494],
      [0, 0.506, 0.494, 0.494],
      [0.506, 0.506, 0.494, 0.494]
    ],
    STRIP: [
      [0, 0, 1, 0.452],
      [0, 0.464, 1, 0.26],
      [0, 0.736, 1, 0.264]
    ],
    HERO: [
      [0, 0, 0.662, 1],
      [0.674, 0, 0.326, 0.494],
      [0.674, 0.506, 0.326, 0.494]
    ]
  };

  /* ---------- colour grades ---------- */

  var GRADES = {
    sunset: {
      filter: "saturate(1.28) contrast(1.07) sepia(0.14) hue-rotate(-10deg)",
      wash: ["rgba(255,45,149,0.16)", "rgba(255,122,61,0.14)"]
    },
    neon: {
      filter: "saturate(1.45) contrast(1.12) hue-rotate(14deg)",
      wash: ["rgba(0,229,255,0.14)", "rgba(150,60,255,0.18)"]
    },
    golden: {
      filter: "saturate(1.18) contrast(1.05) sepia(0.28)",
      wash: ["rgba(255,180,0,0.13)", "rgba(255,110,30,0.10)"]
    },
    mono: {
      filter: "grayscale(1) contrast(1.28) brightness(1.04)",
      wash: ["rgba(20,10,40,0.10)", "rgba(0,0,0,0.14)"]
    }
  };

  var CAPTION_COLORS = {
    pink: "#ff2d95",
    cyan: "#00e5ff",
    gold: "#ffb400",
    white: "#ffffff"
  };

  var DEFAULT_PHOTO = "samples/sunset-heist.jpg";
  var MIN_ZOOM = 1, MAX_ZOOM = 3;

  /* ---------- state ---------- */

  var state = {
    photo: null,          // HTMLImageElement, or null before anything loads
    photoName: "",
    layout: "POSTER",
    panels: [],           // one { fx, fy, zoom } per panel of the layout.
                          // fx/fy are fractions of the maximum pan in
                          // [-1, 1], so a framing looks the same at preview
                          // size and at any export size.
    caption: "SUNSET HEIST",
    subtitle: "VICE CITY \u2022 EST. 2026",
    captionColor: "pink",
    grade: "sunset",
    selected: 0
  };

  var lastExport = null;

  /* ---------- DOM ---------- */

  var canvas = document.getElementById("preview-canvas");
  var ctx = canvas.getContext("2d");
  var wrap = document.getElementById("canvas-wrap");
  var dropHint = document.getElementById("drop-hint");
  var captionInput = document.getElementById("caption-input");
  var subtitleInput = document.getElementById("subtitle-input");
  var zoomSlider = document.getElementById("zoom-slider");
  var zoomReadout = document.getElementById("zoom-readout");
  var fileInput = document.getElementById("file-input");

  function clamp01(v) { return Math.max(-1, Math.min(1, v)); }

  /* ---------- panel geometry ---------- */

  function panelRects(w, h) {
    return LAYOUTS[state.layout].map(function (r) {
      return { x: r[0] * w, y: r[1] * h, w: r[2] * w, h: r[3] * h };
    });
  }

  function freshPanels() {
    return LAYOUTS[state.layout].map(function () {
      return { fx: 0, fy: 0, zoom: 1 };
    });
  }

  // Cover-fit scale for the photo inside a panel, before the panel zoom.
  function baseScale(rect) {
    return Math.max(rect.w / state.photo.width, rect.h / state.photo.height);
  }

  // Drawn size of the photo inside a panel at its current zoom.
  function drawnSize(rect, panel) {
    var s = baseScale(rect) * panel.zoom;
    return { w: state.photo.width * s, h: state.photo.height * s, scale: s };
  }

  // Largest pan, in pixels at this render size, that keeps the panel covered.
  function maxPanPx(rect, panel) {
    var d = drawnSize(rect, panel);
    return {
      x: Math.max(0, (d.w - rect.w) / 2),
      y: Math.max(0, (d.h - rect.h) / 2)
    };
  }

  // Where the photo's top-left corner lands inside its panel, in pixels.
  function photoOffset(rect, panel) {
    var d = drawnSize(rect, panel);
    var m = maxPanPx(rect, panel);
    return {
      x: rect.x + (rect.w - d.w) / 2 + panel.fx * m.x,
      y: rect.y + (rect.h - d.h) / 2 + panel.fy * m.y,
      w: d.w, h: d.h, scale: d.scale
    };
  }

  // Frame a panel by fractions of its maximum pan: fx/fy in [-1, 1].
  // fy = +1 shows the top of the photo, fy = -1 the bottom;
  // fx = +1 shows the left of the photo, fx = -1 the right.
  function framePanel(index, zoom, fx, fy) {
    var panel = state.panels[index];
    if (!panel) return;
    panel.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    panel.fx = clamp01(fx);
    panel.fy = clamp01(fy);
    syncZoomUI();
    renderPreview();
  }

  /* ---------- the shared render ---------- */

  function drawPanel(c, rect, panel) {
    var o = photoOffset(rect, panel);
    c.save();
    c.beginPath();
    c.rect(rect.x, rect.y, rect.w, rect.h);
    c.clip();
    c.filter = GRADES[state.grade].filter;
    c.drawImage(state.photo, o.x, o.y, o.w, o.h);
    c.filter = "none";
    c.restore();
  }

  function drawGradeWash(c, w, h) {
    var wash = GRADES[state.grade].wash;
    var g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, wash[0]);
    g.addColorStop(1, wash[1]);
    c.save();
    c.globalCompositeOperation = "overlay";
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
    // Gentle vignette so the edges fall away like a printed poster.
    var v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.34)");
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  }

  function drawLettering(c, w, h) {
    var unit = Math.min(w, h);
    var caption = state.caption.trim();
    var subtitle = state.subtitle.trim();
    if (!caption && !subtitle) return;

    // A dark band at the bottom keeps the lettering readable over any photo.
    var band = c.createLinearGradient(0, h * 0.62, 0, h);
    band.addColorStop(0, "rgba(5,2,12,0)");
    band.addColorStop(1, "rgba(5,2,12,0.62)");
    c.fillStyle = band;
    c.fillRect(0, h * 0.62, w, h * 0.38);

    var hero = state.layout === "HERO";
    var left = hero ? w * 0.04 : w * 0.5;
    var maxW = w * 0.92;
    c.textAlign = hero ? "left" : "center";
    c.textBaseline = "alphabetic";

    if (caption) {
      var size = unit * 0.115;
      c.font = size + "px Bungee, sans-serif";
      var tw = c.measureText(caption).width;
      if (tw > maxW) {
        size = size * maxW / tw;
        c.font = size + "px Bungee, sans-serif";
      }
      var cy = subtitle ? h * 0.885 : h * 0.925;
      c.lineJoin = "round";
      c.strokeStyle = "rgba(8,2,16,0.9)";
      c.lineWidth = Math.max(2, size * 0.14);
      c.strokeText(caption, left, cy);
      c.shadowColor = "rgba(0,0,0,0.55)";
      c.shadowBlur = size * 0.12;
      c.shadowOffsetY = size * 0.03;
      c.fillStyle = CAPTION_COLORS[state.captionColor];
      c.fillText(caption, left, cy);
      c.shadowColor = "transparent";
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;
    }

    if (subtitle) {
      var sSize = Math.max(10, unit * 0.032);
      c.font = "600 " + sSize + "px 'Chakra Petch', sans-serif";
      try { c.letterSpacing = Math.round(sSize * 0.28) + "px"; } catch (e) {}
      c.fillStyle = "rgba(255,255,255,0.92)";
      c.fillText(subtitle.toUpperCase(), left, h * 0.955);
      try { c.letterSpacing = "0px"; } catch (e) {}
    }
  }

  function drawFrame(c, w, h) {
    c.strokeStyle = "rgba(0,0,0,0.85)";
    c.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
    c.strokeRect(0, 0, w, h);
  }

  // The one render path: preview and export both go through here.
  function renderCover(c, w, h) {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#050308";
    c.fillRect(0, 0, w, h);
    if (!state.photo) return;
    var rects = panelRects(w, h);
    for (var i = 0; i < rects.length; i++) {
      drawPanel(c, rects[i], state.panels[i]);
    }
    drawGradeWash(c, w, h);
    drawLettering(c, w, h);
    drawFrame(c, w, h);
  }

  function renderPreview() {
    renderCover(ctx, canvas.width, canvas.height);
    // Outline the selected panel on the preview only, never in an export.
    if (state.photo && state.panels.length > 1) {
      var r = panelRects(canvas.width, canvas.height)[state.selected];
      if (r) {
        ctx.save();
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
        ctx.restore();
      }
    }
  }

  /* ---------- photo loading ---------- */

  function resetPanelsFor(photoSrc) {
    state.panels = freshPanels();
    // The Sunset Heist sample carries its own title in its lower half, so
    // the default view frames the characters and skyline above it and lets
    // the app's caption do the titling.
    if (photoSrc && photoSrc.indexOf("sunset-heist") !== -1) {
      state.panels.forEach(function (panel) {
        panel.zoom = 1.9;
        panel.fy = 1;
      });
    }
  }

  function loadPhoto(src, name) {
    var img = new Image();
    img.onload = function () {
      state.photo = img;
      state.photoName = name || "";
      resetPanelsFor(src);
      syncZoomUI();
      renderPreview();
    };
    img.onerror = function () {
      state.photo = null;
      renderPreview();
    };
    img.src = src;
  }

  function loadSample(src) {
    document.querySelectorAll(".sample-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.sample === src);
    });
    loadPhoto(src, src.split("/").pop());
  }

  /* ---------- UI wiring ---------- */

  function syncZoomUI() {
    var panel = state.panels[state.selected];
    var pct = panel ? Math.round(panel.zoom * 100) : 100;
    zoomSlider.value = pct;
    zoomReadout.textContent = pct + "%";
  }

  function setLayout(name) {
    if (!LAYOUTS[name]) return;
    state.layout = name;
    state.selected = 0;
    state.panels = freshPanels();
    if (state.photo) resetPanelsFor(state.photoName);
    document.querySelectorAll(".layout-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.layout === name);
    });
    syncZoomUI();
    renderPreview();
  }

  function setGrade(name) {
    if (!GRADES[name]) return;
    state.grade = name;
    document.querySelectorAll(".grade-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.grade === name);
    });
    renderPreview();
  }

  function setCaptionColor(name) {
    if (!CAPTION_COLORS[name]) return;
    state.captionColor = name;
    document.querySelectorAll(".swatch").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.color === name);
    });
    renderPreview();
  }

  function setZoomPercent(pct) {
    var panel = state.panels[state.selected];
    if (!panel) return;
    panel.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pct / 100));
    syncZoomUI();
    renderPreview();
  }

  document.querySelectorAll(".layout-btn").forEach(function (b) {
    b.addEventListener("click", function () { setLayout(b.dataset.layout); });
  });

  document.querySelectorAll(".grade-btn").forEach(function (b) {
    b.addEventListener("click", function () { setGrade(b.dataset.grade); });
  });

  document.querySelectorAll(".swatch").forEach(function (b) {
    b.addEventListener("click", function () { setCaptionColor(b.dataset.color); });
  });

  document.querySelectorAll(".sample-btn").forEach(function (b) {
    b.addEventListener("click", function () { loadSample(b.dataset.sample); });
  });

  captionInput.addEventListener("input", function () {
    state.caption = captionInput.value;
    renderPreview();
  });

  subtitleInput.addEventListener("input", function () {
    state.subtitle = subtitleInput.value;
    renderPreview();
  });

  zoomSlider.addEventListener("input", function () {
    setZoomPercent(parseInt(zoomSlider.value, 10));
  });

  document.getElementById("upload-btn").addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      document.querySelectorAll(".sample-btn").forEach(function (b) {
        b.classList.remove("is-active");
      });
      loadPhoto(reader.result, file.name);
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  /* ---------- drag and drop ---------- */

  var dragDepth = 0;

  wrap.addEventListener("dragenter", function (e) {
    e.preventDefault();
    dragDepth++;
    dropHint.classList.add("visible");
  });

  wrap.addEventListener("dragover", function (e) {
    e.preventDefault();
  });

  wrap.addEventListener("dragleave", function () {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropHint.classList.remove("visible");
  });

  wrap.addEventListener("drop", function (e) {
    e.preventDefault();
    dragDepth = 0;
    dropHint.classList.remove("visible");
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.indexOf("image/") === 0) {
      var reader = new FileReader();
      reader.onload = function () {
        document.querySelectorAll(".sample-btn").forEach(function (b) {
          b.classList.remove("is-active");
        });
        loadPhoto(reader.result, file.name);
      };
      reader.readAsDataURL(file);
    }
  });

  /* ---------- canvas interaction: select, pan, zoom ---------- */

  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * canvas.width / r.width,
      y: (e.clientY - r.top) * canvas.height / r.height
    };
  }

  function panelAt(x, y) {
    var rects = panelRects(canvas.width, canvas.height);
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return 0;
  }

  var dragging = null;

  canvas.addEventListener("pointerdown", function (e) {
    if (!state.photo) return;
    var p = canvasPoint(e);
    state.selected = panelAt(p.x, p.y);
    dragging = { x: p.x, y: p.y };
    canvas.classList.add("dragging");
    canvas.setPointerCapture(e.pointerId);
    syncZoomUI();
    renderPreview();
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!dragging || !state.photo) return;
    var p = canvasPoint(e);
    var panel = state.panels[state.selected];
    var rect = panelRects(canvas.width, canvas.height)[state.selected];
    var m = maxPanPx(rect, panel);
    if (m.x > 0) panel.fx = clamp01(panel.fx + (p.x - dragging.x) / m.x);
    if (m.y > 0) panel.fy = clamp01(panel.fy + (p.y - dragging.y) / m.y);
    dragging = { x: p.x, y: p.y };
    renderPreview();
  });

  function endDrag(e) {
    dragging = null;
    canvas.classList.remove("dragging");
    if (e && e.pointerId !== undefined) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("wheel", function (e) {
    if (!state.photo) return;
    e.preventDefault();
    var p = canvasPoint(e);
    var index = panelAt(p.x, p.y);
    state.selected = index;
    var panel = state.panels[index];
    var rect = panelRects(canvas.width, canvas.height)[index];
    // Zoom toward the cursor: keep the photo point under it fixed.
    var before = photoOffset(rect, panel);
    var imgX = (p.x - before.x) / before.scale;
    var imgY = (p.y - before.y) / before.scale;
    panel.zoom = Math.max(MIN_ZOOM,
      Math.min(MAX_ZOOM, panel.zoom * (1 - e.deltaY * 0.0012)));
    var after = drawnSize(rect, panel);
    var m = maxPanPx(rect, panel);
    var targetX = p.x - imgX * after.scale;
    var targetY = p.y - imgY * after.scale;
    var centerX = rect.x + (rect.w - after.w) / 2;
    var centerY = rect.y + (rect.h - after.h) / 2;
    panel.fx = m.x > 0 ? clamp01((targetX - centerX) / m.x) : 0;
    panel.fy = m.y > 0 ? clamp01((targetY - centerY) / m.y) : 0;
    syncZoomUI();
    renderPreview();
  }, { passive: false });

  /* ---------- export ---------- */

  function renderToSize(w, h) {
    var off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    renderCover(off.getContext("2d"), w, h);
    return off;
  }

  function exportPNG(w, h) {
    if (!state.photo) return null;
    var off = renderToSize(w, h);
    var url = off.toDataURL("image/png");
    var a = document.createElement("a");
    a.href = url;
    a.download = "vice-cover-" + w + "x" + h + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    lastExport = { width: w, height: h, at: Date.now() };
    return url;
  }

  document.querySelectorAll(".export-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var parts = b.dataset.export.split("x");
      exportPNG(parseInt(parts[0], 10), parseInt(parts[1], 10));
    });
  });

  /* ---------- startup ---------- */

  function boot() {
    state.panels = freshPanels();
    loadPhoto(DEFAULT_PHOTO, "sunset-heist.jpg");
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { renderPreview(); });
    }
  }

  /* Test and screenshot hooks: the app's own state and render, exposed
     so an automated check can drive the editor exactly as a person would. */
  window.viceCover = {
    state: state,
    setLayout: setLayout,
    setGrade: setGrade,
    setCaptionColor: setCaptionColor,
    setCaption: function (t) { state.caption = t; captionInput.value = t; renderPreview(); },
    setSubtitle: function (t) { state.subtitle = t; subtitleInput.value = t; renderPreview(); },
    loadSample: loadSample,
    framePanel: framePanel,
    setZoomPercent: setZoomPercent,
    selectPanel: function (i) { state.selected = i; syncZoomUI(); renderPreview(); },
    renderPreview: renderPreview,
    renderToSize: renderToSize,
    exportPNG: exportPNG,
    lastExport: function () { return lastExport; },
    previewDataURL: function () { return canvas.toDataURL("image/png"); }
  };

  boot();
})();
