## Applies-to categories

Flags `(player, pips, target, touchUsable, blank)`: `null` = do not care. `player` true/false = effect must be friendly/hostile; `pips` = effect must (not) have a value; `target` true = must be targeted; `touchUsable` true = must not be a Reroll; `blank` false = must not be a Blank effect.

| Applies-to value                    | Flags (player, pips, target, touchUsable, blank)       | Meaning                                                                               |
| ----------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `YES` (8 keywords)                 | -                                                      | any effect                                                                            |
| `NO` (1 keyword)                    | -                                                      | nothing (cannot be added)                                                             |
| `SPELL` (5 keywords)                | -                                                      | spells/abilities only                                                                 |
| `TARG_PIPS` (10 keywords)           | null, true, true, null, null                           | effects that have a target and a pip value                                            |
| `PIPS_ONLY` (29 keywords)           | null, true, null, null, null                           | effects with a pip value (targeted or not)                                            |
| `TARGET_ONLY` (5 keywords)         | null, null, true, null, false                          | targeted, non-blank effects                                                           |
| `ENEMY_TARG` (1 keyword)            | false, null, true, null, null                          | enemy-side (hostile) targeted effects                                                 |
| `ALLY_TARG_PIPS` (2 keywords)       | true, true, true, null, null                           | friendly targeted effects with pips                                                   |
| `KIND_TARG_PIPS` (4 keywords)       | null, true, true, null, null                           | targeted effects with pips (same check as TARG_PIPS; intended for beneficial effects) |
| `UNKIND_TARG_PIPS` (4 keywords)     | null, true, true, null, null                           | targeted effects with pips (same check as TARG_PIPS; intended for harmful effects)    |
| `UNKIND_TARG` (1 keyword)           | null, null, true, null, null                           | targeted effects (pips not required; intended for harmful effects)                    |
| `NONBLANK_TOUCHUSABLE` (1 keyword) | null, null, null, true, false                          | non-blank effects, excluding Reroll effects                                           |
| `NONBLANK` (10 keywords)            | null, null, null, null, false                          | any non-blank face                                                                    |
| `CANTRIP` (1 keyword)               | null, null, null, null, false (+ not Resurrect/Summon) | non-blank effects except Resurrect and Summon                                         |
| `SINGLE_TARGET` (3 keywords)        | - (TargetingType must be Single)                       | effects with Single targeting                                                         |
| `DEATHCHECK` (1 keyword)            | - (not Mana/Recharge/Reroll/Blank/special add-keyword) | any effect except Mana, Recharge, Reroll, Blank and special add-keyword effects       |

Note: `YES`, `NO`, `SPELL` bypass flag checks; `SPELL` is not checked against flags (spell-only restriction is enforced separately). `KIND_`/`UNKIND_` variants have identical flags to the plain targeted variants; the distinction is intent only.

## How keywords work

- **N and X:** `N` in rule text is the pip value of the face the keyword sits on, so it changes when the face's pips change. `X` is a number written on the keyword itself (e.g. `pain 2`) and does not change with the face's pips. Keywords that take an X have it in their name in the Keyword column. Fixed numbers in rule text, such as +1, are constants.
- A keyword has a rules string (with `N` replaced by the face's pip value) and optionally extra rules shown on the explanation panel (quoted as "Extra text" in the Notes column).
- **Applies to** says which kinds of face the keyword can be added to. A keyword can't be added to a face that already has it. The `permissive` keyword lets any keyword be added to its face.
- Conditional x2 keywords come in two forms: "x2 if I ..." depends only on the user or on earlier dice, while "x2 vs targets ..." depends on the target.
- Many keywords are **derived** from other keywords (self- and inflict- keywords); their text and restrictions come from the base keyword.
- Keyword names are matched case-insensitively. `alliteration` is a legacy alias for `sloth`.

## Effect-type keywords

Keywords that mirror a basic effect type (heal/shield/damage/mana) so it can be added to a face.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `heal` | heal the target for N | `TARG_PIPS` |  |
| `shield` | shield the target for N | `TARG_PIPS` |  |
| `damage` | damage the target for N | `TARG_PIPS` |  |
| `manaGain` | gain N mana | `PIPS_ONLY` |  |
| `selfShield` | shield myself for N | `PIPS_ONLY` |  |
| `selfHeal` | heal myself for N | `PIPS_ONLY` |  |

## Conditional x2 (state / targeting conditions)

Doubles the face's pips when a condition about the user (`if I ...`) or the target (`vs targets ...`) holds.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `cruel` | x2 vs targets on half or less hp | `TARG_PIPS` | Cannot be used with `k<keyword>` generated items. |
| `squish` | x2 vs targets with the least hp of all | `TARG_PIPS` |  |
| `uppercut` | x2 vs targets with the most hp of all | `TARG_PIPS` |  |
| `ego` | x2 vs myself | `ALLY_TARG_PIPS` | Cannot be used with `k<keyword>` generated items. |
| `serrated` | x2 vs targets who have gained no shields this turn | `TARG_PIPS` |  |
| `chain` | x2 if this shares a keyword with the previous dice this turn | `PIPS_ONLY` | Cannot be used with `k<keyword>` generated items. |
| `inspired` | x2 if the previous dice this turn had more pips | `PIPS_ONLY` | Cannot be used with `k<keyword>` generated items. |
| `patient` | x2 if I was not used last turn | `PIPS_ONLY` |  |
| `focus` | x2 vs the target of the previous dice this turn | `TARG_PIPS` |  |
| `sloth` | x2 vs targets with fewer blank faces | `TARG_PIPS` | Legacy alias: "alliteration". |
| `first` | x2 if no dice have been used this turn | `PIPS_ONLY` |  |

## Straights and of-a-kind (multipliers from previous dice)

Multiplier based on the dice already used this turn.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `step` | x2 if this forms a straight of length 2+ with the dice used before it this turn | `PIPS_ONLY` | Extra text: "eg 12, 65" |
| `run` | x3 if this forms a straight of length 3+ with the dice used before it this turn | `PIPS_ONLY` | Extra text: "eg 123, 654" |
| `sprint` | x5 if this forms a straight of length 5+ with the dice used before it this turn | `PIPS_ONLY` | Extra text: "eg 12345, 65432" |
| `pair` | x2 if this has the same pips as the previous dice this turn | `PIPS_ONLY` | |
| `trio` | x3 if this has the same pips as the 2 previous dice this turn | `PIPS_ONLY` |  |
| `quin` | x5 if this has the same pips as the 4 previous dice this turn | `PIPS_ONLY` |  |

## Death checks

Keywords that react to a lethal hit.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `rampage` | can be reused if it was lethal | `DEATHCHECK` |  |

## Pip bonuses (bonus pips per thing)

Add pips to the face for each of something.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `fizz` | +1 pip for each ability used this turn | `PIPS_ONLY` |  |
| `bloodlust` | +1 pip for each damaged enemy | `PIPS_ONLY` | Extra text: "Pips on this face are increased by 1 for each damaged enemy" |
| `flesh` | +1 pip for each hp I have | `PIPS_ONLY` |  |
| `plague` | +1 pip for each poison on all characters | `PIPS_ONLY` |  |
| `acidic` | +1 pip for each poison on me | `PIPS_ONLY` |  |
| `flurry` | +1 pip for each time I have been used this turn | `PIPS_ONLY` |  |
| `era` | +1 pip for each elapsed turn | `PIPS_ONLY` |  |

## Growth and decay

Face changes after use for the rest of the fight (or turn).

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `growth X` | gets +X pips this fight after use | `PIPS_ONLY` | X is written on the keyword, e.g. `growth 1`. Cannot be used with `k<keyword>` generated items. Extra text: "Every time you use this face, the pips on it increase by X for this fight only" |
| `undergrowth X` | After use, the opposite face gets +X pips this fight | `NONBLANK` | X is written on the keyword. Affects the opposite face of the die. |
| `groooooowth` | After use, **all** my faces get +1 pip this fight | `NONBLANK` | Affects all faces of the die. |
| `decay` | gets -1 pip this fight after use | `PIPS_ONLY` |  |

## Target effects (buffs, debuffs, status)

Extra effect applied to the target by the face.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `vulnerable X` | target gains X stacks of Vulnerable (takes 50% more damage). Lose 1 stack at the end of each turn of whoever has it (player or enemy) | `UNKIND_TARG_PIPS` | X is written on the keyword, e.g. `vulnerable 2`. |
| `regen` | target gains N stacks of Regen: heal for the number of stacks at the end of each turn, then lose 1 stack | `KIND_TARG_PIPS` | Base for `selfRegen`. |
| `poison` | also inflicts N unblockable damage at the end of each turn | `UNKIND_TARG_PIPS` | Poison part is unblockable; can only be avoided by cleanse or killing the source. Extra text: "The amount of poison damage is equal to the pips on the face. The poison part of poison damage is unblockable. You can't prevent yourself from being poisoned except by using cleanse or killing the attacking monster." |
| `weak X` | target gains X stacks of Weak (deals 50% less damage). Lose 1 stack at the end of each turn of whoever has it (player or enemy) | `UNKIND_TARG_PIPS` | X is written on the keyword, e.g. `weak 2`. |
| `boost` | target gets +N to all pips this turn | `KIND_TARG_PIPS` | Extra text: "The increase is equal to the pips on this face." |
| `smith` | target gets +N to damage and shield faces this turn | `KIND_TARG_PIPS` |  |
| `permaBoost` | target gets +N to all pips this fight | `KIND_TARG_PIPS` |  |
| `petrify` | turns N faces to stone this fight. At the end of each turn, one randomly chosen petrified face is cleared | `UNKIND_TARG_PIPS` | Extra text: "Petrification order: <petrify order diagram>" |
| `hypnotise` | set target's damage faces to 0 this turn | `UNKIND_TARG` |  |
| `thorns` | N damage to all enemies attacking the target | `ALLY_TARG_PIPS` | Cannot be used with `k<keyword>` generated items. |
| `cleanse` | reduce target's negative effects by N (poisoned, weakened, petrified and inflicted) | `TARG_PIPS` | Base for `selfCleanse`. Extra text: "Cleanse can remove poisoned, weakened, petrified and inflicted. It also affects incoming negative effects." |

## Targeting and restrictions

Change who or what the face can target or hit.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `eliminate` | target must have the least hp | `SINGLE_TARGET` | Monsters using it include incoming damage in their calculation and their targets are locked. Cannot be used with `k<keyword>` generated items. Extra text: "if a monster has this, they include incoming damage in their calculations (and their targets are locked)" |
| `heavy` | target must have the most hp | `SINGLE_TARGET` | Monsters using it include incoming damage and lock targets. Extra text: "if a monster has this, they include incoming damage in their calculations (and their targets are locked)" |
| `ranged` | avoids On-hit passives | `ENEMY_TARG` | Cannot be used with `k<keyword>` generated items. Extra text: "Useful against certain enemy passives." |
| `cleave` | also hits all targets | `SINGLE_TARGET` |  |


## Costs, drawbacks and usage limits

Self-damage, usage counts, mana costs and forced use.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `pain X` | I take X damage | `PIPS_ONLY` | X is written on the keyword, e.g. `pain 2`. Extra text: "Pain damage can be blocked. Damage is resolved in an order favourable to the player always (I hope)" |
| `replay X` | can be used X times in a turn | `NONBLANK_TOUCHUSABLE` | X is written on the keyword, e.g. `replay 2`. Replaces `doubleUse` (replay 2), `quadUse` (replay 4) and `hyperUse`. |
| `exhaust` | after I use this face, replace it with a blank this fight | `NONBLANK` | Base for `inflictExhaust`. |
| `unusable` | cannot be used (manually) | `NONBLANK` | Cantrip still activates. Extra text: "cantrip is still allowed" |
| `exert` | replace all faces with blanks until the end of next turn | `NONBLANK` |  |
| `mandatory` | must be used (if possible) | `NONBLANK` |  |
| `manacost X` | costs X mana | `PIPS_ONLY` | X is written on the keyword. |

## Face behaviour, copying and randomness

Rules about rerolls, face replacement, copying keywords/effects, sharing and randomisation.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `cantrip` | activates during rolling if it lands face-up | `CANTRIP` | Fired during rolling, targets random. Extra text: "Targets chosen randomly. This one is a bit weird... Whilst rolling dice, if this face lands face-up, it gets used instantly without taking up that hero's turn. You can still reroll it and use it as normal." |
| `stasis` | this face cannot change | `YES` | Allowed on any effect. Cannot be used with `k<keyword>` generated items. |
| `permissive` | any keyword can be added to this | `YES` | Any keyword may be added to an effect that has it (bypasses the allow check, except duplicates and Event effects). |
| `sticky` | cannot be rerolled | `YES` |  |
| `enduring` | keywords remain when the face is replaced (if possible) | `YES` | Keywords survive face replacement where possible. Cannot be used with `k<keyword>` generated items. |
| `dogma` | Only pips change when the face is replaced | `YES` | Only pips change on replacement. Cannot be used with `k<keyword>` generated items. |
| `resilient` | pips remain when the face is replaced (if possible) | `YES` | Pips survive face replacement where possible. Cannot be used with `k<keyword>` generated items. |
| `dejavu` | copy the keywords from the faces I used last turn | `NONBLANK` |  |
| `echo` | copy the pips of the previous dice this turn | `PIPS_ONLY` | Cannot be used with `k<keyword>` generated items. |
| `copycat` | copy the keywords from the previous dice this turn | `NONBLANK` | Cannot be used with `k<keyword>` generated items. |
| `resonate` | copy the effect of the previous dice this turn, retaining this face's pips and the resonate keyword | `YES` |  |
| `annul` | targets lose all keywords this turn | `TARGET_ONLY` | Removes all keywords from targets this turn. |
| `shifter` | this face has a random extra keyword, changes each turn. If the keyword chosen takes X, X = N (this face's pips) | `NONBLANK` |  |
| `lucky` | pips are randomised to between 0 and current pips, changes each turn | `PIPS_ONLY` | Re-randomised each turn. |
| `critical` | 50% chance for +1, rechecks each turn | `PIPS_ONLY` | 50% chance each turn. |
| `fluctuate` | changes to a random face each turn, retaining keywords and pips | `YES` |  |
| `phase` | 50% chance to be blank each turn | `NONBLANK` |  |

## Derived: self-targeting versions

Auto-generated: same effect as the base keyword but applied to the user.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `selfRegen` | Like regen but hits me instead of the target | `PIPS_ONLY` | Self-targeting version of `regen`. |
| `selfCleanse` | Like cleanse but hits me instead of the target | `PIPS_ONLY` | Self-targeting version of `cleanse`. |

## Derived: inflict keywords

Auto-generated: add the base keyword to the target's faces for a turn (inflict of inflict allowed).

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `inflictSelfShield` | add selfShield to target's faces for a turn | `TARGET_ONLY` | Inflict version of `selfShield`. |
| `inflictExert` | add exert to target's faces for a turn | `TARGET_ONLY` | Inflict version of `exert`. |
| `inflictPain` | add pain to target's faces for a turn | `TARGET_ONLY` | Inflict version of `pain`. |
| `inflictExhaust` | add exhaust to target's faces for a turn | `TARGET_ONLY` | Inflict version of `exhaust`. |

## Spell / ability keywords

Only valid on spells and abilities, not on dice faces.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `singleCast` | can only be cast once each fight | `SPELL` | Ability-only. |
| `cooldown` | can only be cast once each turn | `SPELL` | Ability-only. |
| `deplete` | costs +1 mana each time it is cast | `SPELL` | Spell-only. |
| `channel` | costs -1 mana each time it is cast (minimum 1) | `SPELL` | Spell-only. |
| `future` | effect is delayed until the start of next turn | `SPELL` | Ability-only. |

## Removed

Placeholder.

| Keyword | Rule text | Applies to | Notes |
|---|---|---|---|
| `removed` | something has been removed, you probably shouldn't be seeing this... | `NO` |  |

## Other keyword-like mechanisms

- **Meta keywords:** `copycat`, `echo`, `resonate`, `fluctuate`, `phase`, `shifter`, `dejavu`. These copy or randomise other keywords or faces, and are used by spell generation.
- **Ability-only keywords:** `singleCast`, `cooldown`, `future`, `deplete`, `channel`. They only apply to spells/abilities, not dice faces, and are excluded from generated keyword modifiers and items.
- **Generated keyword content (text syntax):**
  - `hero.<keyword>` / `monster.<keyword>`: adds the keyword to all faces of all heroes / monsters.
  - `<face-position>.<keyword>`: adds the keyword to specific faces of a die.
  - `k<keyword>`: an item that grants the keyword. Keywords that cannot be used here: copycat, cruel, dogma, echo, ego, enduring, growth, inspired, thorns, resilient, stasis, ranged, eliminate, chain.
- **Derived keyword naming:** derived keywords are a prefix plus the base keyword name: `self`, `inflict`.
- **Translation:** rule text is translated phrase by phrase, with the English sentence as the lookup key.


## Appendix: alphabetical index

`acidic`, `annul`, `bloodlust`, `boost`, `cantrip`, `chain`, `channel`, `cleanse`, `cleave`, `cooldown`, `copycat`, `critical`, `cruel`, `damage`, `decay`, `dejavu`, `deplete`, `dogma`, `echo`, `ego`, `eliminate`, `enduring`, `era`, `exert`, `exhaust`, `first`, `fizz`, `flesh`, `fluctuate`, `flurry`, `focus`, `future`, `groooooowth`, `growth`, `heal`, `heavy`, `hypnotise`, `inflictExert`, `inflictExhaust`, `inflictPain`, `inflictSelfShield`, `inspired`, `lucky`, `manacost`, `manaGain`, `mandatory`, `pain`, `pair`, `patient`, `permaBoost`, `permissive`, `petrify`, `phase`, `plague`, `poison`, `quin`, `rampage`, `ranged`, `regen`, `removed`, `replay`, `resilient`, `resonate`, `run`, `selfCleanse`, `selfHeal`, `selfRegen`, `selfShield`, `serrated`, `shield`, `shifter`, `singleCast`, `sloth`, `smith`, `sprint`, `squish`, `stasis`, `step`, `sticky`, `thorns`, `trio`, `undergrowth`, `unusable`, `uppercut`, `vulnerable`, `weak`

## Removed keywords

Keywords dropped from the original game for this prototype (106).

| Keyword | Rule text | Reason |
|---|---|---|
| `vigil` | +1 pip for each defeated ally | Needs multiple characters |
| `rite` | +1 for each unused ally, they become used | Needs multiple characters |
| `lead` | After use, other hero's faces that share a type with this get +N this turn (eg damage/heal...) | Needs multiple characters |
| `duplicate` | copy this onto all allied faces this turn | Needs multiple characters |
| `share` | targets gain all my keywords this turn (except share) | Needs multiple characters |
| `possessed` | targets as if used by the other side | Needs multiple characters |
| `generous` | cannot target myself | Needs multiple characters |
| `groupExert` | The keyword 'exert' activates for all allies | Needs multiple characters |
| `groupGrowth` | The keyword 'growth' activates for all allies (on this face) | Needs multiple characters |
| `groupDecay` | The keyword 'decay' activates for all allies (on this face) | Needs multiple characters |
| `groupSingleUse` | The keyword 'exhaust' activates for all allies (on this face) | Needs multiple characters |
| `groupGroooooowth` | The keyword 'groooooowth' activates for all allies | Needs multiple characters |
| `moxie` | x2 if I have the least hp of all | Needs multiple characters |
| `bully` | x2 if I have the most hp of all | Needs multiple characters |
| `rescue` | can be reused if it saves a hero | Needs multiple characters |
| `spellRescue` | cost is refunded if it saves a hero | Needs multiple characters |
| `evil` | if this saves a hero, I die | Needs multiple characters |
| `pristine` | x2 if I have full hp | Dropped for prototype |
| `engage` | x2 vs targets with full hp | Dropped for prototype |
| `deathwish` | x2 if I am dying this turn | Dropped for prototype |
| `armoured` | x2 if I have shields | Dropped for prototype |
| `wham` | x2 vs targets with shields | Dropped for prototype |
| `sixth` | x2 if this is the 6th dice you use this turn | Dropped for prototype |
| `reborn` | x2 if I died this fight | Dropped for prototype |
| `terminal` | x2 vs targets on 1 hp | Dropped for prototype |
| `century` | x2 vs targets with 100+ hp | Dropped for prototype |
| `duel` | x2 vs those targeting me this turn | Dropped for prototype |
| `tall` | x2 vs the topmost target | Dropped for prototype |
| `underdog` | x2 vs targets with more hp than me | Dropped for prototype |
| `overdog` | x2 vs targets with less hp than me | Dropped for prototype |
| `dog` | x2 vs targets with equal hp to me | Dropped for prototype |
| `hyena` | x2 vs targets with whom our hp is co-prime | Dropped for prototype |
| `sept` | x7 if this has the same pips as the 6 previous dice this turn | Dropped for prototype |
| `revDiff` | inverted pip delta | Dropped for prototype (Pip delta section) |
| `doubDiff` | doubled pip delta | Dropped for prototype (Pip delta section) |
| `guilt` | if this is lethal, I die | Dropped for prototype |
| `skill` | bonus pips equal to my level | Dropped for prototype |
| `defy` | +1 pip for each incoming damage | Dropped for prototype |
| `charged` | +1 pip for each stored mana | Dropped for prototype |
| `steel` | +1 pip for each shield I have | Dropped for prototype |
| `hoard` | +1 pip for each unequipped item | Dropped for prototype |
| `rainbow` | +1 pip for each keyword on this face | Dropped for prototype |
| `fashionable` | bonus pips equal to the total tier of all items I have equipped | Dropped for prototype |
| `equipped` | +1 pip for each item I have equipped | Dropped for prototype |
| `buffed` | +1 pip for each buff I have | Dropped for prototype |
| `affected` | +1 pip for each 'thing' affecting me | Dropped for prototype |
| `halveEngage` | x0.5 (rounded down) vs targets with full hp | Derived from dropped `engage` |
| `halveDeathwish` | x0.5 (rounded down) if I am dying this turn | Derived from dropped `deathwish` |
| `halveDuel` | x0.5 (rounded down) vs those targeting me this turn | Derived from dropped `duel` |
| `antiEngage` | x2 except vs targets with full hp | Derived from dropped `engage` |
| `antiPristine` | x2 except if I have full hp | Derived from dropped `pristine` |
| `antiDog` | x2 except vs targets with equal hp to me | Derived from dropped `dog` |
| `antiDeathwish` | x2 except if I am dying this turn | Derived from dropped `deathwish` |
| `swapDeathwish` | x2 if target is dying this turn | Derived from dropped `deathwish` |
| `swapEngage` | x2 if I have full hp | Derived from dropped `engage` |
| `swapTerminal` | x2 if I have 1 hp | Derived from dropped `terminal` |
| `engarged` | If engage's condition is met, gain the effects of charged | Derived from dropped `engage` |
| `pristeel` | If pristine's condition is met, gain the effects of steel | Derived from dropped `pristine` |
| `deathlust` | If deathwish's condition is met, gain the effects of bloodlust | Derived from dropped `deathwish` |
| `trill` | If trio's condition is met, gain the effects of skill | Derived from dropped `skill` |
| `duegue` | If duel's condition is met, gain the effects of plague | Derived from dropped `duel` |
| `engine` | x4 if the conditions of both engage and pristine are met | Derived from dropped `engage` |
| `underocus` | x4 if the conditions of both underdog and focus are met | Derived from dropped `underdog` |
| `priswish` | x4 if the conditions of both pristine and deathwish are met | Derived from dropped `pristine` |
| `dispel` | remove all traits from the target this fight | Dropped for prototype |
| `wither` | grants the target -N empty hp this fight | Dropped for prototype (empty hp) |
| `vitality` | grants the target +N empty hp this fight | Dropped for prototype (empty hp) |
| `fierce` | target flees if they have N or less hp (after) | Dropped for prototype |
| `picky` | target must have exactly N hp | Dropped for prototype |
| `scared` | target must have N or less hp | Dropped for prototype |
| `descend` | also hits below the target | Dropped for prototype (no spatial layout) |
| `fault` | Other keywords see N as -1 | Dropped for prototype (Pip-value overrides section) |
| `plus` | Other keywords see N as N+1 | Dropped for prototype (Pip-value overrides section) |
| `doubled` | Other keywords see N as 2N | Dropped for prototype (Pip-value overrides section) |
| `squared` | Other keywords see N as N-squared | Dropped for prototype (Pip-value overrides section) |
| `onesie` | Other keywords see N as 1 | Dropped for prototype (Pip-value overrides section) |
| `threesy` | Other keywords see N as 3 | Dropped for prototype (Pip-value overrides section) |
| `zeroed` | Other keywords see N as 0 | Dropped for prototype (Pip-value overrides section) |
| `treble` | Other keywords x2 -> x3 | Dropped for prototype (Pip-value overrides section) |
| `boned` | Summon a bones | Dropped for prototype |
| `hyperBoned` | Summon N bones | Dropped for prototype |
| `death` | I die | Dropped for prototype |
| `potion` | I discard my topmost 'potion' item permanently | Dropped for prototype |
| `spy` | copy all keywords from the first enemy attack | Dropped for prototype |
| `nothing` | this keyword has no effect | Dropped for prototype |
| `tactical` | counts twice for tactic costs | Dropped for prototype (tactic costs) |
| `selfThorns` |  | Dropped for prototype |
| `selfPoison` | Like poison but hits me instead of the target | Dropped for prototype |
| `selfPetrify` | Like petrify but hits me instead of the target | Dropped for prototype |
| `selfVulnerable` | Like vulnerable but hits me instead of the target | Dropped for prototype |
| `doubleGrowth` | Like growth but activates twice | Dropped for prototype (double activation section) |
| `antiPair` | x2 except if this has the same pips as the previous dice this turn | Dropped for prototype (halve/anti/swap/minus section) |
| `swapCruel` | x2 if I have half or less hp | Dropped for prototype (halve/anti/swap/minus section) |
| `minusFlesh` | -1 pip for each hp I have | Dropped for prototype (halve/anti/swap/minus section) |
| `minusEra` | -1 pip for each elapsed turn | Dropped for prototype (halve/anti/swap/minus section) |
| `cruesh` | If cruel's condition is met, gain the effects of flesh | Dropped for prototype (combined keywords section) |
| `paxin` | x3 if the conditions of pair xor chain is met | Dropped for prototype (combined keywords section) |
| `inflictNothing` | add nothing to target's faces for a turn | Dropped for prototype |
| `inflictInflictNothing` | add inflictNothing to target's faces for a turn | Dropped for prototype |
| `inflictInflictDeath` | add inflictDeath to target's faces for a turn | Dropped for prototype |
| `inflictBoned` | add boned to target's faces for a turn | Derived from dropped `boned` |
| `inflictDeath` | add death to target's faces for a turn | Derived from dropped `death` |
| `hyperGrowth` | gets +N pips this fight after use | Merged into `growth X` |
| `doubleUse` | can be used twice in a turn | Merged into `replay X` |
| `quadUse` | can be used 4 times in a turn | Merged into `replay X` |
| `hyperUse` | can be used N times in a turn | Merged into `replay X` |
