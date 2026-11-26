<!-- Generated from data/*.json by `npm run docs`. Edit data in the editor (editor/), not this file. -->

# Keywords

**100 keywords.** `N` in rule text is the pip value of the face the keyword sits on. `X` is a number written on the keyword itself (e.g. `pain 2`).

## Effect-type keywords

| Keyword      | Rule text                                        | Applies to | Implemented | Notes |
| ------------ | ------------------------------------------------ | ---------- | ----------- | ----- |
| `heal`       | heal the target for N                            | TARG_PIPS  | implemented |       |
| `block`      | gain N block (absorbs incoming damage this turn) | TARG_PIPS  | implemented |       |
| `damage`     | damage the target for N                          | TARG_PIPS  | implemented |       |
| `manaGain`   | gain N mana                                      | PIPS_ONLY  | planned     |       |
| `selfShield` | also gain N block                                | PIPS_ONLY  | implemented |       |
| `selfHeal`   | heal myself for N                                | PIPS_ONLY  | planned     |       |

## Conditional x2 (state / targeting conditions)

| Keyword      | Rule text                                                    | Applies to     | Implemented | Notes                                             |
| ------------ | ------------------------------------------------------------ | -------------- | ----------- | ------------------------------------------------- |
| `cruel`      | x2 vs targets on half or less hp                             | TARG_PIPS      | planned     | Cannot be used with `k<keyword>` generated items. |
| `squish`     | x2 vs targets with the least hp of all                       | TARG_PIPS      | planned     |                                                   |
| `uppercut`   | x2 vs targets with the most hp of all                        | TARG_PIPS      | planned     |                                                   |
| `ego`        | x2 vs myself                                                 | ALLY_TARG_PIPS | planned     | Cannot be used with `k<keyword>` generated items. |
| `serrated`   | x2 vs targets who have gained no shields this turn           | TARG_PIPS      | planned     |                                                   |
| `chain`      | x2 if this shares a keyword with the previous dice this turn | PIPS_ONLY      | planned     | Cannot be used with `k<keyword>` generated items. |
| `inspired`   | x2 if the die played just before had more pips               | PIPS_ONLY      | implemented | Cannot be used with `k<keyword>` generated items. |
| `patient`    | x2 if I was not used last turn                               | PIPS_ONLY      | planned     |                                                   |
| `focus`      | x2 vs the target of the previous dice this turn              | TARG_PIPS      | planned     |                                                   |
| `sloth`      | x2 vs targets with fewer blank faces                         | TARG_PIPS      | planned     |                                                   |
| `first`      | x2 if no dice have been used this turn                       | PIPS_ONLY      | planned     |                                                   |
| `burnDouble` | Deal double damage while you have Burn.                      | DAMAGE         | implemented |                                                   |

## Straights and of-a-kind (multipliers from previous dice)

| Keyword  | Rule text                                                                           | Applies to | Implemented | Notes                         |
| -------- | ----------------------------------------------------------------------------------- | ---------- | ----------- | ----------------------------- |
| `step`   | x2 if this forms a straight of length 2+ with the dice used before it this turn     | PIPS_ONLY  | planned     | Extra text: "eg 12, 65"       |
| `run`    | x3 if this forms a straight of length 3+ with the dice used before it this turn     | PIPS_ONLY  | planned     | Extra text: "eg 123, 654"     |
| `sprint` | x5 if this forms a straight of length 5+ with the dice used before it this turn     | PIPS_ONLY  | planned     | Extra text: "eg 12345, 65432" |
| `pair`   | Double damage or Block if the die you just played had the same unmultiplied pips.   | PIPS_ONLY  | implemented |                               |
| `trio`   | Triple damage or Block if both dice you just played had the same unmultiplied pips. | PIPS_ONLY  | implemented |                               |
| `quin`   | x5 if this has the same pips as the 4 previous dice this turn                       | PIPS_ONLY  | planned     |                               |

## Death checks

| Keyword   | Rule text                      | Applies to | Implemented | Notes |
| --------- | ------------------------------ | ---------- | ----------- | ----- |
| `rampage` | can be reused if it was lethal | DEATHCHECK | planned     |       |

## Pip bonuses (bonus pips per thing)

| Keyword             | Rule text                                                 | Applies to | Implemented | Notes                                                                     |
| ------------------- | --------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------------------------- |
| `fizz`              | +1 pip for each ability used this turn                    | PIPS_ONLY  | planned     |                                                                           |
| `bloodlust`         | +1 pip for each damaged enemy                             | PIPS_ONLY  | planned     | Extra text: "Pips on this face are increased by 1 for each damaged enemy" |
| `flesh`             | +1 pip for each hp I have                                 | PIPS_ONLY  | planned     |                                                                           |
| `plague`            | +1 pip for each poison on all characters                  | PIPS_ONLY  | planned     |                                                                           |
| `acidic`            | +1 pip for each poison on me                              | PIPS_ONLY  | planned     |                                                                           |
| `flurry`            | +1 pip for each time I have been used this turn           | PIPS_ONLY  | planned     |                                                                           |
| `era`               | +1 pip for each elapsed turn                              | PIPS_ONLY  | planned     |                                                                           |
| `burnDamage`        | Deal +1 damage per Burn on you.                           | DAMAGE     | implemented |                                                                           |
| `afterExhaust X`    | Gain X pips if you exhausted a face this turn.            | PIPS_ONLY  | implemented |                                                                           |
| `dieBlanks`         | Gain +1 pip per blank face on this die.                   | PIPS_ONLY  | implemented |                                                                           |
| `kitBlanks X`       | Gain +1 pip per blank face across your dice, up to +X.    | PIPS_ONLY  | implemented |                                                                           |
| `frenzyThreshold X` | Gain the face’s pips again if you have at least X Frenzy. | PIPS_ONLY  | implemented |                                                                           |

## Growth and decay

| Keyword         | Rule text                                            | Applies to | Implemented | Notes                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------- | ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `growth X`      | gets +X pips this fight after use                    | PIPS_ONLY  | implemented | X is written on the keyword, e.g. `growth 1`. Cannot be used with `k<keyword>` generated items. Extra text: "Every time you use this face, the pips on it increase by X for this fight only" |
| `undergrowth X` | After use, the opposite face gets +X pips this fight | NONBLANK   | planned     | X is written on the keyword. Affects the opposite face of the die.                                                                                                                           |
| `groooooowth`   | After use, **all** my faces get +1 pip this fight    | NONBLANK   | planned     | Affects all faces of the die.                                                                                                                                                                |
| `decay`         | gets -1 pip this fight after use                     | PIPS_ONLY  | planned     |                                                                                                                                                                                              |

## Target effects (buffs, debuffs, status)

| Keyword        | Rule text                                                                                                                         | Applies to       | Implemented | Notes                                                                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vulnerable X` | target gains X stacks of Vulnerable (takes 50% more damage, rounded down). Lose 1 stack at the end of each turn of whoever has it | UNKIND_TARG_PIPS | implemented | X is written on the keyword, e.g. `vulnerable 2`.                                                                                                                                                                                                                                                                       |
| `regen`        | target gains N stacks of Regen: heal for the number of stacks at the end of each turn, then lose 1 stack                          | KIND_TARG_PIPS   | planned     | Base for `selfRegen`.                                                                                                                                                                                                                                                                                                   |
| `poison X`     | target gains X stacks of Poison: after enemies act it loses HP equal to its stacks (ignores block), then loses 1 stack            | UNKIND_TARG_PIPS | implemented | Poison part is unblockable; can only be avoided by cleanse or killing the source. Extra text: "The amount of poison damage is equal to the pips on the face. The poison part of poison damage is unblockable. You can't prevent yourself from being poisoned except by using cleanse or killing the attacking monster." |
| `weak X`       | target gains X stacks of Weak (deals 50% less damage, rounded down). Lose 1 stack at the end of each turn of whoever has it       | UNKIND_TARG_PIPS | implemented | X is written on the keyword, e.g. `weak 2`.                                                                                                                                                                                                                                                                             |
| `boost`        | target gets +N to all pips this turn                                                                                              | KIND_TARG_PIPS   | planned     | Extra text: "The increase is equal to the pips on this face."                                                                                                                                                                                                                                                           |
| `smith`        | target gets +N to damage and shield faces this turn                                                                               | KIND_TARG_PIPS   | planned     |                                                                                                                                                                                                                                                                                                                         |
| `permaBoost`   | target gets +N to all pips this fight                                                                                             | KIND_TARG_PIPS   | planned     |                                                                                                                                                                                                                                                                                                                         |
| `petrify`      | turns N faces to stone this fight. At the end of each turn, one randomly chosen petrified face is cleared                         | UNKIND_TARG_PIPS | planned     | Extra text: "Petrification order: <petrify order diagram>"                                                                                                                                                                                                                                                              |
| `hypnotise`    | set target's damage faces to 0 this turn                                                                                          | UNKIND_TARG      | planned     |                                                                                                                                                                                                                                                                                                                         |
| `thorns`       | N damage to all enemies attacking the target                                                                                      | ALLY_TARG_PIPS   | planned     | Cannot be used with `k<keyword>` generated items.                                                                                                                                                                                                                                                                       |
| `cleanse`      | reduce target's negative effects by N (poisoned, weakened, petrified and inflicted)                                               | TARG_PIPS        | planned     | Base for `selfCleanse`. Extra text: "Cleanse can remove poisoned, weakened, petrified and inflicted. It also affects incoming negative effects."                                                                                                                                                                        |
| `burn X`       | Apply X Burn to the enemy. At the end of its turn, it takes damage equal to its Burn, then loses 1 stack.                         | ENEMY_TARGET     | implemented |                                                                                                                                                                                                                                                                                                                         |
| `selfBurn X`   | Apply X Burn to yourself. At the end of your turn, take damage equal to your Burn, then lose 1 stack.                             | NONBLANK         | implemented |                                                                                                                                                                                                                                                                                                                         |

## Targeting and restrictions

| Keyword     | Rule text                                           | Applies to    | Implemented | Notes                                                                                                                                                                                                                                                                 |
| ----------- | --------------------------------------------------- | ------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eliminate` | target must have the least hp                       | SINGLE_TARGET | planned     | Monsters using it include incoming damage in their calculation and their targets are locked. Cannot be used with `k<keyword>` generated items. Extra text: "if a monster has this, they include incoming damage in their calculations (and their targets are locked)" |
| `heavy`     | target must have the most hp                        | SINGLE_TARGET | planned     | Monsters using it include incoming damage and lock targets. Extra text: "if a monster has this, they include incoming damage in their calculations (and their targets are locked)"                                                                                    |
| `ranged`    | avoids On-hit passives                              | ENEMY_TARG    | planned     | Cannot be used with `k<keyword>` generated items. Extra text: "Useful against certain enemy passives."                                                                                                                                                                |
| `cleave`    | hits every enemy instead of one (no target to pick) | SINGLE_TARGET | implemented |                                                                                                                                                                                                                                                                       |

## Costs, drawbacks and usage limits

| Keyword         | Rule text                                                                             | Applies to           | Implemented | Notes                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------- | -------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pain X`        | I take X damage                                                                       | PIPS_ONLY            | planned     | X is written on the keyword, e.g. `pain 2`. Extra text: "Pain damage can be blocked. Damage is resolved in an order favourable to the player always (I hope)" |
| `replay X`      | can be used X times in a turn                                                         | NONBLANK_TOUCHUSABLE | planned     | X is written on the keyword, e.g. `replay 2`. Replaces `doubleUse` (replay 2), `quadUse` (replay 4) and `hyperUse`.                                           |
| `exhaust`       | after I use this face, replace it with a blank this fight                             | NONBLANK             | implemented | Base for `inflictExhaust`.                                                                                                                                    |
| `unusable`      | cannot be used (manually)                                                             | NONBLANK             | planned     | Cantrip still activates. Extra text: "cantrip is still allowed"                                                                                               |
| `exert`         | after this face is used, all of this die's faces are blank until the end of next turn | NONBLANK             | implemented |                                                                                                                                                               |
| `mandatory`     | must be used (if possible)                                                            | NONBLANK             | planned     |                                                                                                                                                               |
| `manacost X`    | costs X mana                                                                          | PIPS_ONLY            | planned     | X is written on the keyword.                                                                                                                                  |
| `frenzySpend X` | If you have X Frenzy, spend it to gain +2 pips per stack spent.                       | PIPS_ONLY            | implemented |                                                                                                                                                               |
| `frenzyAll X`   | Spend all Frenzy to gain X pips per stack spent.                                      | PIPS_ONLY            | implemented |                                                                                                                                                               |

## Face behaviour, copying and randomness

| Keyword      | Rule text                                                                                                        | Applies to  | Implemented | Notes                                                                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cantrip`    | fires when it lands face-up (at a random target) without using the die; the die can still be rerolled and used   | CANTRIP     | implemented | Fired during rolling, targets random. Extra text: "Targets chosen randomly. This one is a bit weird... Whilst rolling dice, if this face lands face-up, it gets used instantly without taking up that hero's turn. You can still reroll it and use it as normal." |
| `stasis`     | this face cannot change                                                                                          | YES         | planned     | Allowed on any effect. Cannot be used with `k<keyword>` generated items.                                                                                                                                                                                          |
| `permissive` | any keyword can be added to this                                                                                 | YES         | planned     | Any keyword may be added to an effect that has it (bypasses the allow check, except duplicates and Event effects).                                                                                                                                                |
| `sticky`     | cannot be rerolled                                                                                               | YES         | planned     |                                                                                                                                                                                                                                                                   |
| `enduring`   | keywords remain when the face is replaced (if possible)                                                          | YES         | planned     | Keywords survive face replacement where possible. Cannot be used with `k<keyword>` generated items.                                                                                                                                                               |
| `dogma`      | Only pips change when the face is replaced                                                                       | YES         | planned     | Only pips change on replacement. Cannot be used with `k<keyword>` generated items.                                                                                                                                                                                |
| `resilient`  | pips remain when the face is replaced (if possible)                                                              | YES         | planned     | Pips survive face replacement where possible. Cannot be used with `k<keyword>` generated items.                                                                                                                                                                   |
| `dejavu`     | copy the keywords from the faces I used last turn                                                                | NONBLANK    | planned     |                                                                                                                                                                                                                                                                   |
| `echo`       | Use the unmultiplied pips of the die you just played this turn. Use your own pips when played first.             | PIPS_ONLY   | implemented | Cannot be used with `k<keyword>` generated items.                                                                                                                                                                                                                 |
| `copycat`    | copy the keywords from the previous dice this turn                                                               | NONBLANK    | planned     | Cannot be used with `k<keyword>` generated items.                                                                                                                                                                                                                 |
| `resonate`   | copy the effect of the previous dice this turn, retaining this face's pips and the resonate keyword              | YES         | planned     |                                                                                                                                                                                                                                                                   |
| `annul`      | targets lose all keywords this turn                                                                              | TARGET_ONLY | planned     | Removes all keywords from targets this turn.                                                                                                                                                                                                                      |
| `shifter`    | this face has a random extra keyword, changes each turn. If the keyword chosen takes X, X = N (this face's pips) | NONBLANK    | planned     |                                                                                                                                                                                                                                                                   |
| `lucky`      | pips are randomised to between 0 and current pips, changes each turn                                             | PIPS_ONLY   | planned     | Re-randomised each turn.                                                                                                                                                                                                                                          |
| `critical`   | 50% chance for +1, rechecks each turn                                                                            | PIPS_ONLY   | planned     | 50% chance each turn.                                                                                                                                                                                                                                             |
| `fluctuate`  | changes to a random face each turn, retaining keywords and pips                                                  | YES         | planned     |                                                                                                                                                                                                                                                                   |
| `phase`      | 50% chance to be blank each turn                                                                                 | NONBLANK    | planned     |                                                                                                                                                                                                                                                                   |

## Derived: self-targeting versions

| Keyword       | Rule text                                      | Applies to | Implemented | Notes                                |
| ------------- | ---------------------------------------------- | ---------- | ----------- | ------------------------------------ |
| `selfRegen`   | Like regen but hits me instead of the target   | PIPS_ONLY  | planned     | Self-targeting version of `regen`.   |
| `selfCleanse` | Like cleanse but hits me instead of the target | PIPS_ONLY  | planned     | Self-targeting version of `cleanse`. |

## Derived: inflict keywords

| Keyword             | Rule text                                   | Applies to  | Implemented | Notes                            |
| ------------------- | ------------------------------------------- | ----------- | ----------- | -------------------------------- |
| `inflictSelfShield` | add selfShield to target's faces for a turn | TARGET_ONLY | planned     | Inflict version of `selfShield`. |
| `inflictExert`      | add exert to target's faces for a turn      | TARGET_ONLY | planned     | Inflict version of `exert`.      |
| `inflictPain`       | add pain to target's faces for a turn       | TARGET_ONLY | planned     | Inflict version of `pain`.       |
| `inflictExhaust`    | add exhaust to target's faces for a turn    | TARGET_ONLY | planned     | Inflict version of `exhaust`.    |

## Spell / ability keywords

| Keyword      | Rule text                                      | Applies to | Implemented | Notes         |
| ------------ | ---------------------------------------------- | ---------- | ----------- | ------------- |
| `singleCast` | can only be cast once each fight               | SPELL      | planned     | Ability-only. |
| `cooldown`   | can only be cast once each turn                | SPELL      | planned     | Ability-only. |
| `deplete`    | costs +1 mana each time it is cast             | SPELL      | planned     | Spell-only.   |
| `channel`    | costs -1 mana each time it is cast (minimum 1) | SPELL      | planned     | Spell-only.   |
| `future`     | effect is delayed until the start of next turn | SPELL      | planned     | Ability-only. |

## Turn sequencing

| Keyword       | Rule text                                                                | Applies to | Implemented | Notes |
| ------------- | ------------------------------------------------------------------------ | ---------- | ----------- | ----- |
| `burnPlays`   | Gain +1 pip for each earlier die you played that applied Burn this turn. | PIPS_ONLY  | implemented |       |
| `afterBurn X` | Gain X pips if the die you just played applied Burn.                     | PIPS_ONLY  | implemented |       |
| `firstBurn X` | Apply X additional Burn if this is your first Burn play this turn.       | NONBLANK   | implemented |       |
| `fullHealth`  | Double damage against a target at full HP.                               | DAMAGE     | implemented |       |
| `clearBurn`   | Deal +1 damage per Burn on you, then clear all your Burn.                | DAMAGE     | implemented |       |
