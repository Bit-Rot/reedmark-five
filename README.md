# Reedmark

Two solo dice-battler prototypes using the same battlefield.

- [Fixed Five](https://bit-rot.github.io/reedmark-five/) keeps five dice throughout a run. Items permanently imprint specific faces, replacing older imprints only where they overlap. New runs use a seeded radius-six hex map.
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

Development defaults to Fixed Five. Use `?mode=pool` for Dice Pool. Add `seed=231` to either mode to replay deterministic outcomes in an isolated run. Unseeded runs save locally under separate mode keys. Run the Fixed Five balance report with `npm run balance -- 96 fixed`. Pass `cautious`, `elite`, or `treasure` as the final argument to run one map policy.

The stage uses Three.js. The rules and authored content have no rendering dependencies. The original marsh background and sprite atlas were made with the built-in ImageGen tool and prepared as optimized WebP assets under `src/art/`.

## Design data and editor

Design data (keywords, faces, dice, characters, items, relics, room types) lives in `data/*.json`; each entity has a stable `id` and everything refers to other entities by ID. The `docs/*.md` tables are **generated** from it (`npm run docs`, checked by `npm test`), so edit data, not those files.

The editor is a static page at `/editor/` on the published site (also installable as an app on Android). It edits `data/*.json`, shows where each ID is used, renames an ID everywhere at once, validates references, and lets you pick a face's image from a library of about 100 icons (`public/face-art/library/`, with a search box). The icons are drawn as vectors in `scripts/face-art/icons.ts`; `npm run face-art` re-renders them (needs Chrome: `PW_CHANNEL=chrome`).

To save from the published page, open the settings (gear) and paste a GitHub fine-grained personal access token limited to this repository with **Contents: Read and write**. The token stays in that browser only. **Save** makes one commit on `main` containing the data, regenerated docs and any images; if `main` moved since you loaded, the changes are merged per entity and any clashes are offered for you to resolve.

The game itself reads this data: dice, items and characters come from `data/*.json` (compiled in `src/data/runtime.ts`), while encounter pools and events are authored in `src/campaign-content.ts`. Normal fights pay 10–20 gold, elites pay 25–35, and bosses pay 95–105. The HUD shows your gold balance for shop purchases. The gear button in the HUD opens a menu with Abandon run. At the camp, instead of an item you are offered a face upgrade: a random keyword from `CAMP_UPGRADES` in `src/content.ts` (cantrip, selfShield, inspired, growth 1, weak 1, vulnerable 1, cleave) that you add to any face it fits. Upgrades are stored per die face, and imprinting an item over a face removes that face's upgrades. Fixed Five starts each turn with two base rerolls and Dice Pool starts with three. The roll commits by itself after the last available reroll. You can also commit manually while holding any number of dice. Faces that need no aim (self or all enemies) are used the moment you click them. Dice have no player-facing name; the `name` in the data is only a label for the editor. A run starts with a hero chosen on a select screen (or `?character=moth`). Each hero starts with five dice in Fixed Five. Moth also starts with Lampheart, a relic that grants Frenzy on the first damage event on each side’s turn, even through Block. The shop stocks three common or uncommon relics, three hero items, and one directional face copy. Rare items and relics come from bosses. A copy duplicates the source slot’s current face and upgrades into the listed destination on the same die. The editor and generated keyword table show which keywords the engine supports. The editor’s validation panel explains when authored data cannot be used in game.

Unsaved edits are kept in the browser, so closing the tab does not lose them. Locally, `npm run dev` serves the editor at `http://localhost:4177/editor/`.

## Fixed Five campaign

Explore any hex adjacent to cleared territory. Ordinary rooms reveal at the frontier, while elites, campfires, shops, and active treasure are visible across the map. Exploring spends one turn. Bosses replace turns 16, 32, and 48. Three treasure chests appear before turns 5, 21, and 37 and expire at the next boss. Each chest grants gold and an unowned common or uncommon relic.

The first two boss victories restore full HP, grant a rare relic, and offer a rare imprint before exploration resumes with harder encounters. The last boss ends the run. Fixed Five saves from the linear route are incompatible with the campaign.

## Orden

Choose Orden in Fixed Five to use his positional starter kit and 20 imprints. Drag dice into specific slots, or focus one and press **1–5**. Reroll locks the dice already in the row. Commit fills the remaining slots and starts manual play. Haste, Brace, Pair, Anchor, Center, Flank, and Bypass reward different placements.

## Face and imprint budgets

Start with 4 pips on Left, 3 on Mid, 2 on Top and Bottom, and 1 on Right and Rightmost. An imprint aims for about twice the base face value, roughly 8/6/4/2. The budget multiplier starts at 1.75× for one edited face, adds 0.15× per additional face, and adds 0.10× for uncommon or 0.20× for rare. Total value matters across the edited faces, so a face can trade strength with another face on the same imprint. Printed Damage and Block each count as 1 pip.

| Effect | Estimated pip value |
| --- | --- |
| Cantrip | Add the printed pips again for the extra activation on a roll. |
| Burn and Self Burn | Sum up to three decaying ticks. Credit 85% of enemy damage and subtract 80% of self damage. |
| Weak and Vulnerable | Count 2 per stack per expected target. |
| Haste and Bypass | Add 3.5 for a repeat and 1.5 for ignoring a slot hazard. |
| Anchor, Pair, Center, and Flank | Count 85%, 80%, 65%, and 65% of the stated bonus. Brace counts 110% for its ability to help both neighbors. |
| Echo | Count 65% of the gap between printed pips and a 5-pip predecessor. |
| Frenzy | Estimate 55% of printed pips for a threshold, 1.5 pips per required stack for Spend, and 2.5 stacks' worth for All. |
| Exhaust and Exert | Subtract 1.5 and 2 respectively for losing future uses. |

`npm run balance -- starters [hero]` audits starter faces. `npm run balance -- items [hero]` shows face estimates, imprint budgets, and gain per roll. `npm run balance -- face <id> [pips]` scores an individual face. These estimates assume a deliberate player with opportunities to trigger combos.

## Enemy dice and hazards

Recover HP by resting at camp, choosing certain events, or defeating a campaign milestone boss. Dice and imprints provide defense during combat.

Campaign fights field two to four enemies, each with its own six-face die. Dark die faces above enemies show the rolled action. A face can combine an attack, Block, or Power with a hazard, and some hazards target two slots.

Mire Gnats spread traps across several slots. Mudrunner drains pips while threatening a heavy hit. Reed Wardens seal the center or edges, while Silt Skaters threaten to petrify faces you use. Later encounters mix those roles and add enemies that threaten lasting Pain and corruption. Reed Wardens, Reedbacks, the Ford Matron, and the Floodgate Keeper can gain Block. Other enemies may use their quieter faces to place hazards or wait.

Numbered hazard markers align with the five dice sockets. Tap a marker to read what it does. Slot hazards apply to the die in that socket when you play it. Some elite and boss faces can instead change a die directly with Pain, petrification, or corruption.

## Deployment

`npm run build:fixed` and `npm run build:pool` produce standalone static games. This repository publishes the fixed build. The [Dice Pool deployment repository](https://github.com/Bit-Rot/reedmark-pool) pins a source commit and builds the pool variant from it. Update that pin to release a tested shared revision to the pool site.
