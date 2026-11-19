# VICE COVER

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/chipuystar/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/chipuystar/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

VICE COVER is an offline web app that turns any photo and a caption into
multi-panel GTA-style poster cover art. Load a photo, pick a layout, pan and
zoom each panel, write the title, pick a Vice City sunset or neon grade, and
export a PNG ready to post.

## How to use

Open `app/index.html` in a desktop browser (or serve the `app/` folder with
any static file server), then:

1. Load a photo — upload one from your machine, drop it onto the preview,
   or try one of the three sample photos.
2. Pick a layout: Poster, Grid, Strip or Hero.
3. Click a panel to select it, drag inside it to pan the photo, scroll or
   use the zoom slider to zoom it.
4. Type the caption and subtitle, pick a caption colour and a colour grade.
5. Export a PNG in 1080x1080, 1080x1350 or 1920x1080.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

## Notes

- The app is plain static files under `app/` — no build step, no network
  requests, no upload. Photos are read on your own machine and never leave it.
- Everything in it is original: no Rockstar logos, artwork or fonts are
  used. The display fonts (Bungee and Chakra Petch) are SIL Open Font
  License files shipped inside `app/fonts/`, and the sample photos were
  made with an image model or supplied by the maker.

---

<sub>Entered on [make.fun](https://make.fun/?ref=0cyw4zjw&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
