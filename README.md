# Reedmark

Two solo dice-battler prototypes using the same battlefield and nine-room route.

- [Fixed Five](https://bit-rot.github.io/reedmark-five/) keeps five dice throughout a run. Items permanently imprint specific faces, replacing older imprints only where they overlap.
- [Dice Pool](https://bit-rot.github.io/reedmark-pool/) starts with ten dice, cycles five at a time, and supports adding, removing, and transforming dice. Each die has one permanent imprint.

## Development

Use Node 22.12 or later. The development checkout was built and tested in a Node 22 Debian container.

```sh
npm ci
npm run dev
npm run check
npm test
npm run balance -- 96
npx playwright install --with-deps chromium
npm run test:browser
```

Development defaults to Fixed Five. Use `?mode=pool` for Dice Pool. Add `seed=231` to either mode to replay deterministic outcomes in an isolated run. Unseeded runs save locally under separate mode keys. The policy runner compares the same enemy rolls, shared encounter lineup, and route with both progression systems.

The stage uses Three.js. The rules and authored content have no rendering dependencies. The original marsh background and sprite atlas were made with the built-in ImageGen tool and prepared as optimized WebP assets under `src/art/`.

## Deployment

`npm run build:fixed` and `npm run build:pool` produce standalone static games. This repository publishes the fixed build. The [Dice Pool deployment repository](https://github.com/Bit-Rot/reedmark-pool) pins a source commit and builds the pool variant from it. Update that pin to release a tested shared revision to the pool site.
