# VICE COVER

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/chipuystar/gta6-cover-art/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/chipuystar/gta6-cover-art/reward.svg)](https://make.fun/c/gta6-cover-art-01)

An offline web app that turns any photo and a caption into multi-panel
GTA-style poster cover art — built for the
[make.fun GTA 6 cover art bounty](https://make.fun/c/gta6-cover-art-01).

Load a photo (or pick a sample), choose a layout, pan and zoom each
panel, write a caption, pick a colour grade, and export a PNG poster in
one of three post sizes. Everything runs in the browser from static
files; no photo ever leaves the machine.

## How to use

1. Open `app/index.html` in desktop Chrome (or serve `app/` with any
   static server — `node serve.ts` works too).
2. Load a photo: upload one, drop it onto the preview, or pick one of
   the three samples. The Sunset Heist sample loads by default.
3. Pick a layout: **Poster** (one full-bleed panel), **Grid** (2&times;2),
   **Strip** (three horizontal bands) or **Hero** (one large panel with
   two small ones beside it).

4. Click a panel to select it, then drag inside it to pan the photo,
   scroll over it (or use the Zoom slider) to zoom it from 100% to 300%.
5. Type a caption and a subtitle, pick a caption colour and a colour
   grade (Vice Sunset, Neon Nights, Golden Hour, Mono Noir).
6. Export a PNG poster: 1080 &times; 1080, 1080 &times; 1350 or
   1920 &times; 1080. The export is rendered by the same code as the
   preview, so what you see is exactly what you get.

## Originality

VICE COVER is an original design. It uses no Rockstar Games logo,
wordmark, official artwork, character or font. The two kit sample photos
(Boulevard, Pier) were made for make.fun and are free to use; the Sunset
Heist sample is the maker's own image. The fonts are Bungee and Chakra
Petch, both released under the SIL Open Font License, served as local
files under `app/fonts/`.

## Files

- `app/index.html`, `app/style.css`, `app/app.js` — the editor.
- `app/fonts/` — Bungee (400) and Chakra Petch (600, 700), WOFF2.
- `app/samples/` — the three sample photos.
- `screenshots/` — four screenshots taken by the maker (see
  `shots.json` for what each shows).
- `main.ts` — the hand-in program: copies `app/` and `screenshots/`
  into the output directory and writes `dossier.json` there.
- `serve.ts` — serves `app/` locally for trying the editor.
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.

## License

MIT — see `LICENSE`.
