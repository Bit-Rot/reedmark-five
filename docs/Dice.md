<!-- Generated from data/*.json by `npm run docs`. Edit data in the editor (editor/), not this file. -->

## About Dice Tables

### Face Mapping

The below chart describes which face corresponds to which position in a die's "t" diagram.

| Column | Position                 | Item text name |
| ------ | ------------------------ | -------------- |
| Face 1 | Left end of the row      | left           |
| Face 2 | Middle of the row        | middle         |
| Face 3 | Top, above the middle    | top            |
| Face 4 | Bottom, below the middle | bottom         |
| Face 5 | Right of the middle      | right          |
| Face 6 | Far right end of the row | rightmost      |

## Dice

| ID                 | Face 1              | Face 2            | Face 3                  | Face 4               | Face 5    | Face 6    |
| ------------------ | ------------------- | ----------------- | ----------------------- | -------------------- | --------- | --------- |
| `die_sword`        | `dmg` 3             | `dmg` 2           | `dmg` 1                 | `dmg` 1              | `block` 1 | `block` 1 |
| `die_shield`       | `block` 3           | `block` 2         | `block` 2               | `block` 2            | `block` 1 | `block` 1 |
| `die_hammer`       | `dmgVulnerable` 2   | `dmgVulnerable` 2 | `dmgBlock` 1            | `dmgBlock` 1         | `blank`   | `blank`   |
| `die_dagger`       | `dmgCantrip` 1      | `dmgCantrip` 1    | `dmgCantrip` 1          | `dmgCantrip` 1       | `blank`   | `blank`   |
| `die_dodge`        | `blockCantrip` 1    | `blockCantrip` 1  | `blockCantrip` 1        | `blockCantrip` 1     | `blank`   | `blank`   |
| `die_kris`         | `dmgWeak` 2         | `dmgWeak` 2       | `dmg` 2                 | `dmg` 2              | `blank`   | `blank`   |
| `die_moth_strike`  | `dmg` 3             | `dmg` 2           | `dmg` 2                 | `dmg` 2              | `dmg` 1   | `block` 1 |
| `die_moth_guard`   | `blockSelfBurn` 3   | `block` 3         | `block` 2               | `block` 2            | `block` 1 | `block` 1 |
| `die_moth_lantern` | `dmgWhileBurning` 3 | `burnEnemy`       | `dmgExhaust` 5          | `blockSpendFrenzy` 2 | `blank`   | `blank`   |
| `die_orden_edge`   | `dmg` 4             | `dmg` 3           | `dmg` 2                 | `dmg` 2              | `dmg` 1   | `block` 1 |
| `die_orden_file`   | `dmg` 4             | `dmg` 3           | `dmg` 2                 | `block` 2            | `dmg` 1   | `block` 1 |
| `die_orden_guard`  | `block` 4           | `block` 3         | `block` 2               | `dmg` 2              | `block` 1 | `dmg` 1   |
| `die_orden_shield` | `block` 4           | `block` 3         | `dmg` 2                 | `block` 2            | `block` 1 | `block` 1 |
| `die_orden_signal` | `dmg` 4             | `block` 3         | `orden-signal-anchor` 2 | `block` 2            | `block` 1 | `dmg` 1   |
