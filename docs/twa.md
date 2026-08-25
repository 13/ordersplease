# docs/twa.md — Play Store wrap (later)

The game is a PWA; wrapping it for the Play Store uses Bubblewrap against
the GitHub Pages URL:

1. Enable Pages for this repo: Settings → Pages → Source: GitHub Actions.
2. After the first main deploy, the app lives at
   https://13.github.io/ordersplease/
3. `npm i -g @bubblewrap/cli && bubblewrap init --manifest \
   https://13.github.io/ordersplease/manifest.webmanifest`
4. `bubblewrap build` produces the signed AAB; upload via Play Console
   (requires a developer account) and host the generated
   `assetlinks.json` under `public/.well-known/`.

Nothing in this file is automated; it is a checklist for when store
distribution becomes worth it.
