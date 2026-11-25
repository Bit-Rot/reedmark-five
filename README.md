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

## Design data and editor

Design data (keywords, faces, dice, characters, items, relics, room types) lives in `data/*.json`; each entity has a stable `id` and everything refers to other entities by ID. The `docs/*.md` tables are **generated** from it (`npm run docs`, checked by `npm test`), so edit data, not those files. The old Slice & Dice extraction is kept for reference in `docs/legacy/`.

The editor is a static page at `/editor/` on the published site (also installable as an app on Android). It edits `data/*.json`, shows where each ID is used, renames an ID everywhere at once, validates references, and lets you pick a face's image from a library of about 100 icons (`public/face-art/library/`, with a search box). The icons are drawn as vectors in `scripts/face-art/icons.ts`; `npm run face-art` re-renders them (needs Chrome: `PW_CHANNEL=chrome`).

To save from the published page, open the settings (gear) and paste a GitHub fine-grained personal access token limited to this repository with **Contents: Read and write**. The token stays in that browser only. **Save** makes one commit on `main` containing the data, regenerated docs and any images; if `main` moved since you loaded, the changes are merged per entity and any clashes are offered for you to resolve.

The game itself reads this data: dice, items and characters come from `data/*.json` (compiled in `src/data/runtime.ts`), while enemies and rooms are still authored in `src/content.ts`. Winning a fight pays gold (normal 10-20, elite 25-35, boss 95-105, as in Slay the Spire); it is shown in the HUD but nothing spends it yet. The gear button in the HUD opens a menu with Abandon run. At the camp, instead of an item you are offered a face upgrade: a random keyword from `CAMP_UPGRADES` in `src/content.ts` (cantrip, selfShield, inspired, growth 1, weak 1, vulnerable 1, cleave) that you add to any face it fits. Upgrades are stored per die face, and imprinting an item over a face removes that face's upgrades. The roll commits by itself after the last reroll or once every die is held, and faces that need no aim (self or all enemies) are used the moment you click them. Dice have no player-facing name; the `name` in the data is only a label for the editor. Early fights are tuned so the starter dice usually win them untouched (`npm run balance -- 60 fixed` reports how often). A run starts with a hero chosen on a select screen (or `?character=thief`); each hero starts with its five `starterDice`. Keywords the engine can run are `damage`, `block`, `selfShield`, `poison X`, `vulnerable X`, `weak X`, `exert` and `cantrip` (flagged `implemented` in the editor); a die, item or hero that uses anything else is left out of the game and the editor's validation panel says why.

Unsaved edits are kept in the browser, so closing the tab does not lose them. Locally, `npm run dev` serves the editor at `http://localhost:4177/editor/`; `npm run migrate` re-imports the legacy md tables (one-off, it overwrites `data/`).

## Deployment

`npm run build:fixed` and `npm run build:pool` produce standalone static games. This repository publishes the fixed build. The [Dice Pool deployment repository](https://github.com/Bit-Rot/reedmark-pool) pins a source commit and builds the pool variant from it. Update that pin to release a tested shared revision to the pool site.
