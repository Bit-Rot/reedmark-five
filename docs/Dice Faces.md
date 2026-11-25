<!-- Generated from data/*.json by `npm run docs`. Edit data in the editor (editor/), not this file. -->

## Active Dice Faces

These dice faces are active and intended to be enabled and implemented in-game.

| Template               | Targeting    | Keywords                              | Image                                                                                       | Notes                        |
| ---------------------- | ------------ | ------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| `blank`                | None         |                                       | <img src="../public/face-art/library/blank.webp" width="48" alt="blank">                    | Does nothing, cannot be used |
| `dmg`                  | Single Enemy | {damage}                              | <img src="../public/face-art/library/sword.webp" width="48" alt="dmg">                      |                              |
| `block`                | Self         | {block}                               | <img src="../public/face-art/library/shield.webp" width="48" alt="block">                   |                              |
| `dmgCantrip`           | Single Enemy | {damage}<br>{cantrip}                 | <img src="../public/face-art/library/dagger.webp" width="48" alt="dmgCantrip">              |                              |
| `dmgVulnerable`        | Single Enemy | {damage}<br>{exert}<br>{vulnerable 1} | <img src="../public/face-art/library/hammer.webp" width="48" alt="dmgVulnerable">           |                              |
| `dmgBlock`             | Single Enemy | {damage}<br>{selfShield}              | <img src="../public/face-art/library/sword_shield.webp" width="48" alt="dmgBlock">          |                              |
| `blockCantrip`         | Self         | {block}<br>{cantrip}                  | <img src="../public/face-art/library/boot_dash.webp" width="48" alt="blockCantrip">         |                              |
| `poison`               | Single Enemy | {damage}<br>{poison 1}                | <img src="../public/face-art/library/drop.webp" width="48" alt="poison">                    |                              |
| `dmgWeak`              | Single Enemy | {damage}<br>{weak 1}                  | <img src="../public/face-art/library/kris.webp" width="48" alt="dmgWeak">                   |                              |
| `weak`                 | Single Enemy | {weak 1}<br>{exert}                   | <img src="../public/face-art/library/sad_face.webp" width="48" alt="weak">                  | Pips do nothing at baseline  |
| `dmgSingleCast`        | Single Enemy | {singleCast}<br>{damage}              | <img src="../public/face-art/library/bomb.webp" width="48" alt="dmgSingleCast">             |                              |
| `blockSelfBurn`        | Self         | {block}<br>{selfBurn 1}               | <img src="../public/face-art/library/shield_flame.webp" width="48" alt="blockSelfBurn">     |                              |
| `burnEnemy`            | Single Enemy | {burn 2}                              | <img src="../public/face-art/library/flame.webp" width="48" alt="burnEnemy">                |                              |
| `dmgExhaust`           | Single Enemy | {damage}<br>{exhaust}                 | <img src="../public/face-art/library/hammer_crack.webp" width="48" alt="dmgExhaust">        |                              |
| `dmgApplyBurn`         | Single Enemy | {damage}<br>{burn 1}                  | <img src="../public/face-art/library/sword_flame.webp" width="48" alt="dmgApplyBurn">       |                              |
| `blockExhaust`         | Self         | {block}<br>{exhaust}                  | <img src="../public/face-art/library/cracked_shield.webp" width="48" alt="blockExhaust">    |                              |
| `dmgDieBlanks`         | Single Enemy | {damage}<br>{dieBlanks}               | <img src="../public/face-art/library/stinger.webp" width="48" alt="dmgDieBlanks">           |                              |
| `dmgPerBurn`           | Single Enemy | {damage}<br>{burnDamage}              | <img src="../public/face-art/library/sword_flame.webp" width="48" alt="dmgPerBurn">         |                              |
| `dmgWhileBurning`      | Single Enemy | {damage}<br>{burnDouble}              | <img src="../public/face-art/library/sword_flame.webp" width="48" alt="dmgWhileBurning">    |                              |
| `blockDieBlanks`       | Self         | {block}<br>{dieBlanks}                | <img src="../public/face-art/library/cloak.webp" width="48" alt="blockDieBlanks">           |                              |
| `dmgAfterExhaust`      | Single Enemy | {damage}<br>{afterExhaust 3}          | <img src="../public/face-art/library/broken_sword.webp" width="48" alt="dmgAfterExhaust">   |                              |
| `blockFrenzyThreshold` | Self         | {block}<br>{frenzyThreshold 3}        | <img src="../public/face-art/library/shield.webp" width="48" alt="blockFrenzyThreshold">    |                              |
| `dmgSpendFrenzy`       | Single Enemy | {damage}<br>{frenzySpend 2}           | <img src="../public/face-art/library/claw.webp" width="48" alt="dmgSpendFrenzy">            |                              |
| `dmgAllWhileBurning`   | All Enemies  | {damage}<br>{burnDouble}              | <img src="../public/face-art/library/sword_flame.webp" width="48" alt="dmgAllWhileBurning"> |                              |
| `burnExhaust`          | Single Enemy | {burn 4}<br>{exhaust}                 | <img src="../public/face-art/library/bomb_spark.webp" width="48" alt="burnExhaust">         |                              |
| `dmgSelfBurn`          | Single Enemy | {damage}<br>{selfBurn 1}              | <img src="../public/face-art/library/sword_flame.webp" width="48" alt="dmgSelfBurn">        |                              |
| `blockSpendFrenzy`     | Self         | {block}<br>{frenzySpend 2}            | <img src="../public/face-art/library/gauntlet.webp" width="48" alt="blockSpendFrenzy">      |                              |
| `blockAfterExhaust`    | Self         | {block}<br>{afterExhaust 3}           | <img src="../public/face-art/library/bell.webp" width="48" alt="blockAfterExhaust">         |                              |
| `dmgFrenzyThreshold`   | Single Enemy | {damage}<br>{frenzyThreshold 3}       | <img src="../public/face-art/library/claw.webp" width="48" alt="dmgFrenzyThreshold">        |                              |
| `dmgKitBlanks`         | Single Enemy | {damage}<br>{kitBlanks 6}             | <img src="../public/face-art/library/moon.webp" width="48" alt="dmgKitBlanks">              |                              |
| `dmgSpendAllFrenzy`    | Single Enemy | {damage}<br>{frenzyAll 2}             | <img src="../public/face-art/library/bomb_spark.webp" width="48" alt="dmgSpendAllFrenzy">   |                              |
| `healExhaust`          | Self         | {heal}<br>{exhaust}                   | <img src="../public/face-art/library/potion.webp" width="48" alt="healExhaust">             |                              |
| `blockKitBlanks`       | Self         | {block}<br>{kitBlanks 5}              | <img src="../public/face-art/library/crown.webp" width="48" alt="blockKitBlanks">           |                              |
| `burnAll`              | All Enemies  | {burn 3}                              | <img src="../public/face-art/library/flame.webp" width="48" alt="burnAll">                  |                              |
| `blockSelfBurnTwo`     | Self         | {block}<br>{selfBurn 2}               | <img src="../public/face-art/library/shield_flame.webp" width="48" alt="blockSelfBurnTwo">  |                              |
