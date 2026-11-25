## How to read the tables

- **Colour = class** (`HeroCol`). Six core colours: yellow, orange, grey, red, blue, green. Tier = `HTBill(colour, tier)` (the "level"): tier 1 starters, tier 2 and 3 are level-up replacements of the same colour. Base hp targets by tier: 1 -> 5, 2 -> 7.4, 3 -> 9 (`HeroTypeUtils.getHpFor`); the hp column is the actual `.hp()` of each hero.
- **S1 to S6** are the six die sides in the order they are written in the source (`HTBill.sides(...)`). The engine then permutes them (`EntType.niceToReal`) so that, by `EntDieUtils.fromIndex`, S1 = Left, S2 = Middle, S3 = Top, S4 = Bottom, S5 = Right, S6 = Rightmost face (derived from the swap order; the positions matter for items like "top side +1" and for Mimic).
- Hero definitions that list fewer than six sides are padded with blanks by `ETBill.sides(...)`: 1 or 2 given sides fill S1 (and S2), the rest blank; 3 given sides land in S1, S2 and **S5**; 4 and 5 given sides fill S1-S4 / S1-S5. The tables show the padded result, so a blank in the table may be a padding blank.
- Side text: the base effect with pips (`2 damage`, `Shield 3`, `Heal 4`, `+2 mana`), then the keywords in `{braces}` using the game's keyword names (see the [glossary](#keyword-glossary)). Descriptions are built from the `ESB` side definitions; wording follows the game's `EffType.describe` where available (for example "Revive the top-most defeated hero", "Gain 1 reroll", "Another hero can use their die again"). Keyword pips scale with the side value N.
- **Ability**: a Spell costs mana (mana sides feed a shared pool) and is cast from the hero panel; a Tactic has no mana cost but is paid by *dice sides already used that turn* (a `damage pip` cost is satisfied by damage sides, with a side of value v counting as v pips). The text after `, then` is the spell's `bonusUntargeted` extra effect, applied after the main effect. "power xN" is the balance multiplier passed to `SpellBill.power` / `Tactic`, not a gameplay value. Spells have curly-brace keywords too (`singleCast`, `cooldown`, `deplete`...).
- Hidden traits that are chat/flavour only are marked as such. Anything generated at pick time (random items, modifiers, heroes) is marked *dynamic*.

## Colours

- **Yellow**: fighters: damage and shield heavy, many self-cost/"pain" sides.
- **Orange**: rogues, rangers and cantrip users: ranged, poison, dodge, cantrips.
- **Grey**: defenders: shields, redirect, undying, support keywords.
- **Red**: healers and support: healing, mana, regen, resurrection, group spells.
- **Blue**: mages: mana sides plus a damage/utility spell.
- **Green**: "weird" heroes, unlocked as a colour by the 50-achievements milestone; odd traits, on-pick rewards, tactics.

## Tier 1

| Hero | Colour | HP | S1 | S2 | S3 | S4 | S5 | S6 | Ability | Traits / notes / unlock |
|---|---|---:|---|---|---|---|---|---|---|---|
| **Fighter** | Yellow | 5 | 2 damage | 2 damage | 1 damage | 1 damage | Shield 1 | Shield 1 | - | - |
| **Brigand** | Yellow | 5 | 3 damage {exert} | 3 damage {exert} | 1 damage {selfShield} | 1 damage {selfShield} | 1 damage | 1 damage | - | Unlock: Alt-T1 set A: complete (win) any run. |
| **Lazy** | Yellow | 6 | 3 damage | Shield 3 | Blank | Blank | Blank | Blank | - | - |
| **Thief** | Orange | 4 | 2 damage {ranged} | 2 damage | Blank | Blank | 2 damage | Blank | - | - |
| **Scoundrel** | Orange | 7 | 1 damage to all enemies | 1 damage {vulnerable} | Blank | Blank | Blank | Blank | - | - |
| **Lost** | Orange | 3 | 1 damage {ranged, poison} | 2 damage {cruel} | 1 damage {cruel} | 1 damage {cruel} | Dodge (self: avoid all damage and enemy effects this turn) | Blank | - | Unlock: Alt-T1 set A: complete (win) any run. |
| **Defender** | Grey | 7 | Shield 3 | Shield 2 | 1 damage | 1 damage | Shield 1 | Blank | - | - |
| **Squire** | Grey | 5 | Shield 2 {focus} | 1 damage {focus} | Redirect all damage and enemy effects from a target enemy to me {selfShield 2} | Redirect all damage and enemy effects from a target enemy to me {selfShield 2} | Shield 1 | Shield 1 | - | Unlock: Alt-T1 set B: 10 achievements. |
| **Wallop** | Grey | 5 | Give a hero Undying (cannot die this turn) | 2 damage {selfShield} | Stun an enemy [target hp <= mine] | Stun an enemy [target hp <= mine] | 1 damage {selfShield} | Blank | - | Unlock: Alt-T1 set A: complete (win) any run. |
| **Housecat** | Green | 3 | 3 damage | 1 damage {cleave} | Blank | Blank | 1 damage {cleave} | Blank | - | Trait ForeverYoung: cannot level up. Trait ReplaceChat: its speech is always a random cat noise. Sides use the wolf-bite (plain damage) and claw-slash (cleave) art. |

## Tier 2

| Hero | Colour | HP | S1 | S2 | S3 | S4 | S5 | S6 | Ability | Traits / notes / unlock |
|---|---|---:|---|---|---|---|---|---|---|---|
| **Brute** | Yellow | 8 | 2 damage {selfShield} | 2 damage {selfShield} | 3 damage {heavy} | 3 damage {heavy} | Stun an enemy [target hp <= mine] | Blank | - | - |
| **Soldier** | Yellow | 7 | 3 damage | 3 damage | 2 damage | 2 damage | Shield 2 | Shield 2 | - | - |
| **Whirl** | Yellow | 8 | 1 damage to all enemies | 3 damage | 1 damage {cleave} | 1 damage {cleave} | Shield 1 {cleave} | Blank | - | - |
| **Sinew** | Yellow | 8 | 1 damage {cleave, chain} | Shield 2 | 4 damage {exert} | 4 damage {exert} | Shield 2 | Blank | - | Unlock: 30 achievements. |
| **Gambler** | Orange | 7 | 5 damage | 3 damage | Blank | Blank | 1 damage | Blank | - | Two hidden flavour traits (chat only): cheers when its die stops on its highest damage side, boos when it stops on a blank with 0 rolls left. |
| **Rogue** | Orange | 7 | 2 damage {cruel} | 1 damage {cantrip} | 1 damage {poison} | 1 damage {poison} | 1 damage {cantrip} | Dodge (self: avoid all damage and enemy effects this turn) | - | - |
| **Trapper** | Orange | 8 | Kill a monster with 4 hp or less {ranged} | Dodge (self: avoid all damage and enemy effects this turn) | 1 damage {vulnerable} | 1 damage {vulnerable} | Dodge (self: avoid all damage and enemy effects this turn) | Blank | - | - |
| **Armorer** | Grey | 9 | 3 damage {heavy} | Shield 4 | Shield 1 {cleave} | Shield 1 {cleave} | Shield 1 {smith} | Shield 1 {smith} | - | - |
| **Bard** | Grey | 6 | Shield 2 {cantrip} | Gain 1 reroll {cantrip} | Shield 1 to all heroes | Shield 1 to all heroes | 1 damage {cantrip} | Blank | **Else** (tactic, 1x blank side): Shield 1 {cleanse} | Unlock: 40 achievements (tactics). |
| **Pilgrim** | Grey | 8 | Recharge: another hero can use their die again | Give a hero Undying (cannot die this turn) | Give a hero keyword(s) {selfShield} on all their sides this turn | Give a hero keyword(s) {selfShield} on all their sides this turn | Stun an enemy [target hp <= mine] | Stun an enemy [target hp <= mine] | - | Unlock: 30 achievements. |
| **Monk** | Grey | 9 | Shield 2 {cleanse} | Shield 1 {thorns} | Redirect all damage and enemy effects from a target enemy to me {selfShield 3} | Redirect all damage and enemy effects from a target enemy to me {selfShield 3} | Shield 1 {thorns} | Blank | - | - |
| **Warden** | Grey | 10 | Shield 4 | Shield 3 | 2 damage | 2 damage | Shield 2 | Shield 1 | - | - |
| **Granite** | Green | 5 | Give a hero Undying (cannot die this turn) | 3 damage {heavy} | 2 damage {heavy} | 2 damage {heavy} | Blank | Blank | - | Trait StoneSpecialHp on the inner 2 hp pips: those pips must be removed one at a time (damage is capped to one pip per hit there). |
| **Statue** | Green | 25 | Blank | Blank | Blank | Blank | Blank | Blank | - | 25 hp, all six sides blank. Picking Statue twice unlocks the item Statuette. |
| **Mimic** | Green | 10 | Blank (unset: filled by the Mimic trait) | Blank (unset: filled by the Mimic trait) | Blank (unset: filled by the Mimic trait) | Blank (unset: filled by the Mimic trait) | Blank (unset: filled by the Mimic trait) | Blank (unset: filled by the Mimic trait) | - | All sides are "blank (unset)" placeholders. Trait: replaces its sides with the Middle-position base side of other heroes (in petrify order from top to bottom, before items). Dynamic: resolved at runtime from the party. |
| **Sphere** | Green | 9 | Stun an enemy [target hp <= mine] | Gain 1 reroll {cantrip} | Blank | Blank | Gain 1 reroll {cantrip} | Blank | **Slam** (tactic, 2x 1-keyword side): 4 damage {heavy} | - |
| **Alien** | Green | 8 | Target enemy: pure keyword effect {poison} 2 | Target enemy: pure keyword effect {damage} 3 | Target ally: pure keyword effect {shield} 3 | Target ally: pure keyword effect {shield} 3 | Target ally: pure keyword effect {cleanse} 2 | Blank | **Devoid** (tactic, 1x blank side + 2x damage pip): Kill a monster [targets with 2 hp or less] | All non-blank sides are pure-keyword "target" sides (no base effect, the pips feed the keyword). |

## Tier 3

| Hero | Colour | HP | S1 | S2 | S3 | S4 | S5 | S6 | Ability | Traits / notes / unlock |
|---|---|---:|---|---|---|---|---|---|---|---|
| **Veteran** | Yellow | 11 | 4 damage | 4 damage | 3 damage | 3 damage | Shield 3 | Shield 3 | - | - |
| **Captain** | Yellow | 10 | 3 damage {focus} | 1 damage {cleave, chain} | Shield 4 | Shield 4 | 1 damage {cleave, chain} | Blank | **Formation** (tactic, 3x damage pip + 3x shield pip): 2 damage to all enemies, then shield 2 to all heroes | Unlock: 40 achievements (tactics). |
| **Ludus** | Orange | 7 | 6 damage | 5 damage | 4 damage | 3 damage | 1 damage | 2 damage | - | Hidden flavour traits (chat only): cheers when its die stops on its best side; special chat line ("Brother") on killing a Sudul. Picking Ludus twice unlocks the Sudul monster. |
| **Sharpshot** | Orange | 8 | Kill a monster with 6 hp or less {ranged} | 3 damage {ranged} | 3 damage {ranged} | 3 damage {ranged} | 2 damage {ranged, copycat} | Blank | - | - |
| **Stoic** | Grey | 15 | Stun an enemy [target hp <= mine] | Redirect all damage and enemy effects from a target enemy to me {selfShield 3} | 2 damage {selfShield} | 2 damage {selfShield} | Redirect all damage and enemy effects from a target enemy to me {selfShield 2} | Redirect all damage and enemy effects from a target enemy to me {selfShield 1} | - | - |
| **Tainted** | Green | 14 | Blank {stasis} | Dodge (self: avoid all damage and enemy effects this turn) | 3 damage {cleave} | 3 damage {cleave} | 4 damage {poison} | Shield 3 {cleave} | - | On pick, gain 1 random tier -3 modifier (a curse; generated at pick time - dynamic). |
| **Luggage** | Green | 5 | Shield 1 {cleave} | Shield 1 {cleave} | Blank | Blank | Blank | Blank | - | On pick, gain three random items: one each of tier 6, tier 7 and tier 8 (dynamic). |

## Extras and non-designed heroes

Note: `Tw1n` is declared inline inside the Twin definition (`TwinPersonal(new HTBill(...).name("Tw1n"))`), so a naive scan of the blob files counts it as a 22nd Green hero and a 129th hero; `makeDesigned()` itself returns **128** types (Green 21).

Not in `makeDesigned()` / the pickable pool, or not fixed content:

| Hero | Colour | Tier | HP | S1 | S2 | S3 | S4 | S5 | S6 | Notes |
|---|---|---:|---:|---|---|---|---|---|---|---|
| **generated_default** | red | n | `(int)getHpFor(n)` | Blank x6 |  |  |  |  |  | Placeholder hero from `HeroTypeUtils.defaultHero(tier)`; hp from the tier formula. |

Other hero sources that are **dynamic / not enumerable** from code:

- **Generated heroes** (`PipeHeroGenerated`): name pattern `<colour letter><tier>.<hex seed>` (for example `y3.1a2b3c`); random sides/hp for any `HeroCol` and tier 0-5. Used by Generate/Alternate modes, the "generated heroes" option, and `HeroTypeUtils.getRandom` when no designed hero fits. Not listed (infinite).
- **Level-up heroes** beyond tier 3 (and tier 0): produced by the pipe DSL, for example `HeroTypeBlobPink.levelupExample(from)` builds `<hero>.tier.<n>.hp.<n>.i.<item>.n.<name>` with a random item and hp scaled by `getHpFor`. Dynamic.
- **Hero modifier pipes** (`<hero>.hp.N`, `.col.`, `.sd.` sides, `replica.<hero>`, `x2.<hero>`, `.i.<item>`, ...) create variants of any hero by name; not enumerated.
- **Curated mods** (`resources/misc/cm/{cancelion,moshui,oknano,punpun,thunder}.txt`) add community heroes as DSL text via `GlobalExtraLevelupOptions`; they are loaded only when the curated-mods feature is active and are not part of this list.
- `HeroCol` also defines non-core colours (`purple`, `violet`, `dark`, `white`, `lime`, `cyan`, `sea`, `amber`, `mahogany`, and `quish`...`iuish` hex-named) used by generated/custom heroes. **No designed hero uses them** except the Glitch fallback (violet).

## Unlock conditions

Unlocks verified in `gameplay/progress/chievo/achievementTypes/`. Heroes not listed are available from the start (subject to colour unlocks).

| Colour / hero group | Unlock |
|---|---|
| Yellow, Orange, Grey colours | available from the start |
| Red and Blue colours | Achievement "First Boss": beat level 4 |
| Green colour (all 21 designed green heroes) | 50 achievements completed (`ProgressAchievement(50, HeroCol.green)`) |
| Alt-T1 set A: Lost, Brigand, Wallop | Complete any run (`HeroTypeUtils.getAltT1s(0)`) |
| Alt-T1 set B: Squire | 10 achievements |
| Sinew, Pilgrim | 30 achievements |
| Captain, Bard | 40 achievements (together with the Tactics feature) |

The Fighter, Thief and Defender (Healer and Mage were removed) are default starters ("BASICS" in `HeroTypeUtils`). Several hero pick counts also unlock items/monsters (Gambler, Ludus, Dancer, Bard, Jester, Ace, Poet, Statue, Herbalist: "choose X twice").

## Keyword glossary

Rule text paraphrased from `effect/eff/keyword/Keyword.java` (N = the pips on the side). Only keywords that appear on the heroes above are listed.

| Keyword | Rule |
|---|---|
| `cantrip` | Activates during rolling if it lands face-up (targets chosen randomly); does not use up the hero's turn and can still be rerolled. |
| `chain` | x2 if this shares a keyword with the previous dice this turn. |
| `cleanse` | Reduce the target's negative effects (poisoned, weakened, petrified, inflicted) by N. |
| `cleave` | Also hits both sides of the target. |
| `copycat` | Copy the keywords from the previous dice this turn. |
| `cruel` | x2 vs targets on half or less hp. |
| `damage` | Damage the target for N (used on pure-keyword "target" sides). |
| `exert` | Replace all sides with blanks until the end of next turn. |
| `focus` | x2 vs the target of the previous dice this turn. |
| `heavy` | Target must have the most hp. |
| `poison` | Also inflicts N unblockable damage at the end of each turn. |
| `ranged` | Can target enemies in the back row and avoids on-hit passives. |
| `regen` | Heal for N at the end of each turn. |
| `thorns` | N damage to all enemies attacking the target. |
| `selfShield` | Shield myself for N. |
| `shield` | Shield the target for N (used on pure-keyword "target" sides). |
| `smith` | Target gets +N to damage and shield sides this turn. |
| `stasis` | This side cannot change. |
| `vulnerable` | Target takes +N damage from dice and spells this turn. |

## Removed characters

Characters removed because a die face is `(removed)`, or a face has a healing, mana or pain effect (95). Spell/ability text was not used as a criterion.

| Hero | Colour | Tier | Reason(s) |
|---|---|---|---|
| Berserker | Yellow | 2 | (removed) face, pain |
| Collector | Yellow | 2 | (removed) face |
| Gladiator | Yellow | 2 | (removed) face |
| Scrapper | Yellow | 2 | (removed) face |
| Barbarian | Yellow | 3 | (removed) face, pain |
| Brawler | Yellow | 3 | (removed) face |
| Curator | Yellow | 3 | (removed) face, mana |
| Leader | Yellow | 3 | (removed) face |
| Bash | Yellow | 3 | (removed) face |
| Eccentric | Yellow | 3 | (removed) face |
| Wanderer | Yellow | 3 | (removed) face |
| Dabble | Orange | 1 | healing, mana |
| Clumsy | Orange | 1 | pain |
| Dabbler | Orange | 2 | healing, mana |
| Ranger | Orange | 2 | (removed) face |
| Spellblade | Orange | 2 | mana |
| Ninja | Orange | 2 | (removed) face |
| Juggler | Orange | 2 | pain |
| Assassin | Orange | 3 | (removed) face |
| Dancer | Orange | 3 | pain |
| Fencer | Orange | 3 | (removed) face |
| Venom | Orange | 3 | healing |
| Roulette | Orange | 3 | (removed) face |
| Dabblest | Orange | 3 | healing, mana |
| Agent | Orange | 3 | (removed) face, pain |
| Buckle | Grey | 1 | (removed) face |
| Alloy | Grey | 1 | healing |
| Knight | Grey | 2 | (removed) face |
| Cleric | Grey | 2 | healing, mana |
| Guardian | Grey | 2 | (removed) face |
| Keeper | Grey | 3 | (removed) face, healing |
| Paladin | Grey | 3 | healing |
| Prince | Grey | 3 | (removed) face, healing |
| Stalwart | Grey | 3 | (removed) face |
| Poet | Grey | 3 | (removed) face, mana |
| Valkyrie | Grey | 3 | (removed) face, healing |
| Healer | Red | 1 | healing, mana |
| Gardener | Red | 1 | healing, mana |
| Acolyte | Red | 1 | (removed) face, healing, mana |
| Mystic | Red | 1 | healing, mana |
| Splint | Red | 1 | healing, mana |
| Druid | Red | 2 | healing, mana |
| Herbalist | Red | 2 | healing, mana |
| Medic | Red | 2 | healing, mana |
| Priestess | Red | 2 | (removed) face, healing, mana |
| Vampire | Red | 2 | healing, mana |
| Enchanter | Red | 2 | (removed) face, healing, mana |
| Disciple | Red | 2 | (removed) face, healing, mana |
| Fey | Red | 2 | healing, mana |
| Doctor | Red | 3 | healing, mana |
| Forsaken | Red | 3 | healing, mana, pain |
| Prophet | Red | 3 | (removed) face, healing, mana |
| Shaman | Red | 3 | (removed) face, healing, mana |
| Witch | Red | 3 | healing, mana |
| Wraith | Red | 3 | healing, mana |
| Surgeon | Red | 3 | (removed) face, healing, mana |
| Fate | Red | 3 | healing, mana |
| Mage | Blue | 1 | mana |
| Prodigy | Blue | 1 | healing, mana, pain |
| Meddler | Blue | 1 | (removed) face, mana, pain |
| Student | Blue | 1 | mana |
| Initiate | Blue | 1 | mana |
| Cultist | Blue | 1 | healing, mana, pain |
| Caldera | Blue | 2 | mana |
| Evoker | Blue | 2 | mana |
| Glacia | Blue | 2 | mana |
| Jester | Blue | 2 | mana |
| Sparky | Blue | 2 | (removed) face, mana |
| Myco | Blue | 2 | healing, mana |
| Seer | Blue | 2 | mana |
| Fiend | Blue | 2 | healing, mana, pain |
| Artificer | Blue | 3 | (removed) face, healing, mana |
| Weaver | Blue | 3 | mana |
| Sorcerer | Blue | 3 | mana |
| Chronos | Blue | 3 | mana |
| Warlock | Blue | 3 | healing, mana, pain |
| Ace | Blue | 3 | mana |
| Ghast | Blue | 3 | (removed) face, mana |
| Wizard | Blue | 3 | mana |
| Tinder | Green | 1 | pain |
| Reflection | Green | 1 | pain |
| Primrose | Green | 1 | healing |
| Spade | Green | 1 | healing |
| Pockets | Green | 1 | (removed) face, healing |
| Presence | Green | 2 | (removed) face, healing |
| Spine | Green | 2 | healing |
| Coffin | Green | 2 | pain |
| Vessel | Green | 3 | (removed) face, healing |
| Jumble | Green | 3 | healing |
| Dice | Green | 3 | healing |
| Robot | Green | 3 | (removed) face, healing, pain |
| Twin | Green | 3 | healing, pain |
| Tw1n | green | 3 | healing, pain |
| Ruffian | Yellow | 1 | pain |
| Hoarder | Yellow | 1 | (removed) face, pain |
