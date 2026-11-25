<!-- Generated from data/*.json by `npm run docs`. Edit data in the editor (editor/), not this file. -->

## Active Dice Faces

These dice faces are active and intended to be enabled and implemented in-game.

| Template      | Targeting    | Keywords                              | Icon Description                                           | Image | Notes                        |
| ------------- | ------------ | ------------------------------------- | ---------------------------------------------------------- | ----- | ---------------------------- |
| `blank`       | None         |                                       |                                                            |       | Does nothing, cannot be used |
| `slash`       | Single Enemy | {damage}                              | A plain sword                                              |       |                              |
| `block`       | Self         | {block}                               | A plain shield                                             |       |                              |
| `stab`        | Single Enemy | {damage}<br>{cantrip}                 | A plain dagger                                             |       |                              |
| `bash`        | Single Enemy | {damage}<br>{exert}<br>{vulnerable 1} | A plain hammer                                             |       |                              |
| `slash_block` | Single Enemy | {damage}<br>{selfShield}              | A plain sword and shield                                   |       |                              |
| `dash`        | Self         | {block}<br>{cantrip}                  | A foot stepping with speed lines and a small cloud of dust |       |                              |
| `poison`      | Single Enemy | {damage}<br>{poison 1}                | A single drop of poison                                    |       |                              |
| `hobble`      | Single Enemy | {damage}<br>{weak 1}                  | A curvy kris dagger                                        |       |                              |
| `weak`        | Single Enemy | {weak 1}<br>{exert}                   | A sad face                                                 |       | Pips do nothing at baseline  |
