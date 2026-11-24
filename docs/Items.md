# Slice & Dice - Item Catalogue

Source: `src/com/tann/dice/gameplay/content/item/blob/ItemBlob{Negative,Zero,OneFive,SixNine,TenPlus}.java` (builder `ItBill(tier, name).prs(<Personal triggers>)`), registry `ItemLib` (quality range -7..20). Effects below are resolved by reading the trigger classes (`AffectSides`, `ESB` side templates, `Keyword` rules). Read-only research; nothing in the reference folder was modified.

## Contents

- [Negative tiers - cursed items](#negative-tiers---cursed-items) (24)
- [Tier 0](#tier-0) (55)
- [Tiers 1-5](#tiers-1-5) (182)
- [Tiers 6-9](#tiers-6-9) (90)
- [Tiers 10+](#tiers-10) (33)
- [Counts](#counts)
- [Reading guide / side positions](#reading-guide--side-positions)
- [Keyword glossary](#keyword-glossary)
- [Findings and caveats](#findings-and-caveats)
- [Removed items](#removed-items)

## Counts

- **Total items: 384** = 358 named equipment items + 24 spell items ("Learn X") + 2 tactic items. (470 before removing 85 items that use removed keywords; see [Removed items](#removed-items).)
- Cursed / force-equip (`ForceEquip` trigger): 24 remaining.
- Potions (item name contains "potion"): 0 (every potion item used the removed `potion` keyword).
- Distribution by tier: t-7: 1, t-4: 2, t-2: 10, t-1: 11, t0: 55, t1: 46, t2: 35, t3: 33, t4: 35, t5: 33, t6: 28, t7: 26, t8: 20, t9: 16, t10: 5, t11: 4, t12: 5, t13: 2, t14: 6, t15: 5, t16: 4, t17: 2.
- No other fixed item definitions exist outside these five blob files; `ItemLib.init()` only adds `ItemBlob.makeAll()` and then registers the string-DSL pipes (`PipeItem`), which generate further items (combined, random `ritem.*`, `hat.*`, `cast.*` etc.) on demand and are not enumerated here. No item is marked `.hidden()`.

## Reading guide / side positions

A hero die has 6 sides. Item text uses these names:

| Name | Side(s) | Name | Side(s) |
|---|---|---|---|
| left | side 2 | left+mid ("left2") | left, mid |
| mid | side 4 | right+rightmost ("right2") | right, rightmost |
| top | side 0 | mid, right, rightmost ("right3") | three right sides |
| bot / bottom | side 1 | row | left, mid, right, rightmost |
| right | side 3 | column | top, mid, bot |
| rightmost | side 5 | top and bottom ("wings") | top, bot |

Other conventions: "pips" = the number on a side; "basic" sides are plain (keyword-free) damage/shield/heal/mana sides; "max hp" lines add real hp, "empty hp" adds hp pips that start empty; "incoming" bonuses affect values applied to the wearer. "Colour-linked" items only apply their side change while the wearer is that hero colour. "Tier" is the raw `ItBill` tier. Spell/tactic items grant the named ability to the wearer ("Learn " + title).

## Negative tiers - cursed items

24 items.

| Name | Tier | Effect | Notes |
|---|---|---|---|
| Dead Crow | -7 | Wearer dies at the start of combat. | Cursed (force-equip); tier is computed (deadHero(0.85) = -6.8, rounded) |
| Amnesia | -4 | All sides become blank. | Cursed (force-equip); tier is computed (blanked(0.8) = -4.27, rounded) |
| Empathy | -4 | Whenever an enemy dies, the wearer dies. | Cursed (force-equip) |
| Cursed Bolt | -2 | After any ability is used, wearer takes 2 damage. | Cursed (force-equip) |
| Slimed | -2 | All sides gain `sticky` (cannot be rerolled). | Cursed (force-equip) |
| Soul Link | -2 | When any ally dies, the wearer dies. | Cursed (force-equip) |
| Wretched Crown | -2 | On death: kills all allies. | Cursed (force-equip) |
| Broken Spirit | -2 | Immune to healing and to shields. | Cursed (force-equip) |
| Exhaustion | -2 | All sides gain `exert`. | Cursed (force-equip) |
| Compulsion | -2 | All sides gain `mandatory` and `pain`. | Cursed (force-equip) |
| Conscience | -2 | Whenever an enemy dies, wearer takes 1 damage. | Cursed (force-equip) |
| Parasite | -2 | Starting hp set to 1. | Cursed (force-equip) |
| Pharaoh Curse | -2 | All sides -1 pip. | Cursed (force-equip) |
| Tracked | -1 | On death: summons 2 wolves. | Cursed (force-equip) |
| Broken Heart | -1 | Immune to healing. | Cursed (force-equip) |
| Weariness | -1 | Left+mid sides gain `exert`. | Cursed (force-equip) |
| Coiled Snake | -1 | Starts each fight poisoned (1). | Cursed (force-equip) |
| Brittle | -1 | Death is permanent. | Cursed (force-equip) |
| Affliction | -1 | Left+mid sides gain `pain`. | Cursed (force-equip) |
| Lead Weight | -1 | Top and bottom sides become blank. | Cursed (force-equip) |
| Handcuffs | -1 | -1 item slot. | Cursed (force-equip) |
| Mould | -1 | All sides gain `decay`. | Cursed (force-equip) |
| D4 | -1 | Right side becomes 1 damage to self with `cantrip`. | Cursed (force-equip) |
| Barrel Hoops | -1 | On death: 5 damage to adjacent allies. | Cursed (force-equip) |

## Tier 0

55 items.

| Name | Tier | Effect | Notes |
|---|---|---|---|
| Old Root | 0 | Basic heal sides +2 pips. |  |
| Learn Oof | 0 | Tactic (cost: 5 blank sides): 5 damage. | Tactic |
| Knot | 0 | Blank sides gain `permissive`. |  |
| Cholesterol | 0 | +5 empty hp; immune to healing. |  |
| Twiddle | 0 | Swaps top and bottom sides. |  |
| Void | 0 | No effect (no triggers). | Blank item |
| Yearn | 0 | Blank sides become heal+shield+managain (0 pips). |  |
| Splinter | 0 | -1 max hp. |  |
| Learn Betray | 0 | Spell (cost 2): kill a friendly hero. | Spell |
| Learn Aid | 0 | Spell (cost 1): heal 2 to the enemy group. | Spell |
| Learn Mana | 0 | Spell (cost 1): gain 1 mana; single cast. | Spell |
| Learn Hinder | 0 | Spell (cost 1): 1 damage to a friendly hero with `weak`. | Spell |
| Spanner | 0 | Rightmost side reverts to its innate side (undoes other items on it). |  |
| Peanut Shell | 0 | +1 empty hp. | Force-equip (tier 0, not a negative tier) |
| Extra Pocket | 0 | +1 item slot. |  |
| Learn Burstic | 0 | Tactic (cost: 2 basic mana sides): casts Burst (shield 2 or damage 2). | Tactic |
| Brick | 0 | Basic shield sides gain `petrify`. |  |
| Cracked Emerald | 0 | Gains the effects of all tier-12 items on other heroes. |  |
| Fly | 0 | Left side gains `growth` and `decay`. |  |
| Rusty Longsword | 0 | Left, mid, right and rightmost sides become 1 damage. |  |
| Bond Certificate | 0 | On the 15th turn only: all sides +15 pips. |  |
| Bent Spoon | 0 | Left+mid sides +0 (no effect). | Joke item |
| Bent Fork | 0 | Right+rightmost sides x1 (no effect). | Joke item |
| Bent Spork | 0 | Top, mid and bot sides x-1 (negates pips). |  |
| Toy Sword | 0 | Rightmost side becomes 0 damage. |  |
| Wooden Armour | 0 | +2 max hp; all sides -1 pip. |  |
| Burred Shield | 0 | Left side becomes 5 shield with `pain`. |  |
| Hidden Strength | 0 | Bottom side becomes 10 damage to all enemies with `manacost`. |  |
| Rorrim Tekcop | 0 | Copies rightmost side onto left. |  |
| Dull Wit | 0 | Mana sides become basic damage (same pips); lose `managain`. |  |
| Dead Branch | 0 | Bottom side becomes 1 damage, `exhaust` (stick). |  |
| Two of Clubs | 0 | Left, mid, top, bot, right -1 pip; rightmost +1. |  |
| Flea | 0 | Sides with exactly 0 pips get +1 pip and `pain`. |  |
| Cracked Phylactery | 0 | Left+mid sides gain `selfHeal`; -6 max hp. |  |
| Sprinkles | 0 | Violet heroes only benefit: left side +1. | Colour-linked (violet) |
| Grass | 0 | Blank sides become petrified blanks (still blank). | Joke item |
| Stoneskin | 0 | +2 max hp; all sides become blank. |  |
| Learn Niche | 0 | Spell (cost 2): kill a target with exactly 46 hp. | Spell |
| Learn Invoke | 0 | Spell (cost 1): summon a demon. | Spell |
| Orbit | 0 | Applies `Shift row across by 1` four times; the shift is a 4-cycle so the net layout looks unchanged (inferred). | Joke item |
| Camomile | 0 | Removes `cantrip` from all sides. |  |
| Overprepared | 0 | During turn 0 only: all sides +1 pip. | Turn 0 is not a normal turn; likely never active (unverified) |
| Pin | 0 | Blank sides become 1 damage to self with `cantrip`. |  |
| Atlas Stone | 0 | Top and bottom sides +1; -2 item slots. |  |
| Huge Scabbard | 0 | Sides with exactly 10 pips get +1. |  |
| Banana Peel | 0 | Right+rightmost sides become a 'give cantrip' side. |  |
| Lawnmower | 0 | Removes all green keywords from all sides. |  |
| Scoundrel Stash | 0 | Scoundrel only; left+mid sides +1. | Equip-restricted: Scoundrel |
| Learn Tsrub | 0 | Spell (cost 2): choose 2 damage to a friendly OR 2 shield to an enemy. | Spell |
| Dusty Emerald | 0 | Gains the effects of all tier-0 items on other heroes. |  |
| Tin Foil Hat | 0 | Cosmetic reveal: re-skins keyworded sides as their equivalent named side; no stat change (inferred). | Joke item |
| Stale Bread | 0 | Left becomes 0-pip reroll `cantrip`; mid becomes blank. |  |
| Taxes | 0 | All sides gain `mandatory`. |  |
| Learn bank | 0 | Spell (cost 4): gain 3 mana next turn (`future`); single cast. | Spell |
| Name Tag | 0 | Keep old name when levelling up. |  |
| Shovel Bite | 0 | Levels up into Spade. |  |

## Tiers 1-5

182 items.

| Name | Tier | Effect | Notes |
|---|---|---|---|
| Arrow | 1 | All damage sides become Headshot: kill a target with 2 or less hp (ranged). |  |
| Memory | 1 | Left side reverts to innate. |  |
| Balisong | 1 | Left side becomes 1 damage `cantrip`. |  |
| Corset | 1 | Left side blank; mid side +1. |  |
| Tankard | 1 | Mid side gains `acidic`. |  |
| Doll | 1 | Left side replaced by the hero above's left side; top, mid, bot, right and rightmost -1. |  |
| Wand of Wand | 1 | Left side becomes 1 damage, `exhaust`, `inflictExhaust`. |  |
| Sorcery Notes | 1 | Left becomes 1 mana `cantrip`; mid blank. |  |
| Quiver | 1 | Top, mid, bot, right, rightmost become 1 ranged damage. |  |
| Pendulum | 1 | Swaps left and mid sides. |  |
| Tattered Robes | 1 | Mid, right and rightmost become 1 mana; +1 max mana (party). |  |
| Leather Vest | 1 | +1 max hp. |  |
| Healing Wand | 1 | Rightmost becomes 4 heal, `exhaust`. |  |
| Castor Root | 1 | Blank sides become 1 heal. |  |
| Seedling | 1 | Left becomes 2 damage with `growth`. |  |
| Reagents | 1 | Right blank; rightmost becomes 1 heal with `regen`. |  |
| Rusty Plate | 1 | Mid blank; +3 max hp. |  |
| Anchor | 1 | Start of combat: gain 1 shield. |  |
| Big Shield | 1 | Left becomes 4 shield. |  |
| Cloak | 1 | Mid becomes dodge (self). |  |
| Scar | 1 | +5 empty hp. |  |
| Ballet Shoes | 1 | Swaps left and rightmost sides. |  |
| Change of Heart | 1 | Heal sides become basic shield (same pips). |  |
| Emerald Shard | 1 | Gains the effects of all tier-2 items on other heroes. |  |
| Barkskin | 1 | Immune to shields; +2 max hp. |  |
| Knife Bag | 1 | Blank sides become 1 damage `cantrip` with `pain`. |  |
| Big Heart | 1 | Mid becomes 7 heal. |  |
| Compass | 1 | Rotates sides clockwise around the middle (top, right, bot, left cycle). |  |
| Bone Charm | 1 | No hp penalty when defeated. |  |
| Infused Herbs | 1 | Bottom becomes 2 heal with `cleanse`, `boost`, `manacost`. |  |
| Learn Poultice | 1 | Spell (cost 1): heal 2; single cast. | Spell |
| Cheating Sleeves | 1 | Top and bottom gain `quin`. |  |
| Copper Ring | 1 | +1 empty hp; +1 max mana. |  |
| Wolf Ears | 1 | Max hp set to 6. |  |
| Basilisk Scale | 1 | Starts petrified for 1 (one side turned to stone); top side +3. |  |
| Glass Helm | 1 | +3 max hp; death is permanent. |  |
| Iron Heart | 1 | All sides gain `exert` and +1 pip. |  |
| Bowl | 1 | Top, mid, bot revert to innate. |  |
| Coin | 1 | Left gains `phase` and +1 pip. |  |
| Trowel | 1 | Mid becomes 1 resurrect. |  |
| Tincture | 1 | Rightmost gains `cleanse`. |  |
| Necromancer Tome | 1 | Party may use abilities of defeated heroes; left becomes 3 mana with `pain`. |  |
| Clumsy Shoes | 1 | Targeted sides gain `heavy`, `eliminate` and +1 pip. | Both keywords restrict target (most hp / least hp) |
| Autumn Leaf | 1 | Rightmost gains `growth`. |  |
| Fletching | 1 | Left gains `ranged`. |  |
| Pillow | 1 | Left gains `patient`. |  |
| Learn Wings | 2 | Spell (cost 2): heal 3 to the top and bottom heroes. | Spell |
| Ice Cube | 2 | Left gains `stasis`. |  |
| Worn Arms | 2 | Top becomes 2 damage; bottom becomes 2 shield. |  |
| Static Tome | 2 | Top and bottom become 1 mana with `pair`. |  |
| Origami | 2 | Flips die: each side swaps with its opposite (left/right, top/bot, mid/rightmost). |  |
| Statuette | 2 | Left, mid, right, rightmost blank; +6 max hp. |  |
| Spinach | 2 | Start of combat: heal 3. |  |
| Sapphire | 2 | Mid becomes 2 mana. |  |
| Ace of Spades | 2 | Left +2; all other sides -2. |  |
| Garnet | 2 | +1 to incoming healing. |  |
| Powdered Mana | 2 | Blank sides become 1 mana. |  |
| Burning Blade | 2 | Left becomes 4 damage; -2 max hp. |  |
| Citrine Ring | 2 | Rightmost +1. |  |
| Big Hammer | 2 | Left becomes 5 damage `heavy`; mid blank. |  |
| Twin Daggers | 2 | Top and bottom become 1 damage `cantrip`. |  |
| Liqueur | 2 | Swaps top and rightmost; +2 max mana. |  |
| Peaked Cap | 2 | Copies mid side onto left. |  |
| Sapphire Skull | 2 | On death: gain 2 mana. |  |
| First aid Kit | 2 | Orange heroes only: bottom becomes 2 heal with `cleanse`. | Colour-linked (orange) |
| Friendship Bracelet | 2 | +2 empty hp; monsters flee at 5x your hp instead of 10x. |  |
| Clumsy Hammer | 2 | Top becomes 5 damage with `heavy` and `eliminate`. |  |
| Tower Shield | 2 | Mid becomes 10 shield with `heavy`. |  |
| Square Wheel | 2 | Mid becomes 1 reroll `cantrip`; right and rightmost blank. |  |
| Silver Imp | 2 | Top and bottom become 1 reroll `cantrip` with `pain`. |  |
| Wandify | 2 | Right+rightmost gain `exhaust` and +1 pip. |  |
| Leather Gloves | 2 | Copies rightmost side onto top and bottom. |  |
| Learn remedy | 2 | Spell (cost 1): heal 1 with `cleanse`; single cast. | Spell |
| Golden Thread | 2 | Yellow heroes only: all non-damage sides +1. | Colour-linked (yellow) |
| Rejuvenation Wand | 2 | Top and bottom become 10 heal, `exhaust`. |  |
| Quicksilver | 2 | Unused shields are kept between turns. |  |
| Faint Halo | 2 | When wearer saves a hero: +1 max hp (buff). |  |
| Clover | 2 | Left +1, mid -2. |  |
| Syringe | 2 | While the party has 2 or fewer heroes: all sides gain `cantrip`. |  |
| Duvet | 2 | Mid, right, rightmost gain `patient`. |  |
| Wild Seeds | 2 | Left+mid gain `undergrowth`. |  |
| Kilt | 3 | Copies right side onto rightmost. |  |
| Polearm | 3 | Damage sides replaced by a copy of the wearer's top side. |  |
| Flickering Blade | 3 | Rightmost becomes 1 damage with `copycat`. |  |
| Buckler | 3 | Mid becomes 3 shield with `bloodlust`. |  |
| Terrarium | 3 | Right becomes 2 shield with `growth`; rightmost becomes 1 mana with `growth`. |  |
| Learn Flare | 3 | Spell (cost 4): 5 damage. | Spell |
| Longbow | 3 | Top and bottom become 2 ranged damage. |  |
| Juice | 3 | Left gains `selfCleanse`. |  |
| Golden Cup | 3 | +100 empty hp; +100 max mana. |  |
| Ash | 3 | Mid+right gain `enduring`. |  |
| Pure Heart Pendant | 3 | Mid becomes 3 heal with `cleanse`. |  |
| Learn sprout | 3 | Spell (cost 3): heal 3 with `channel`. | Spell |
| Scalpel | 3 | Red heroes only: damage sides +1. | Colour-linked (red) |
| Lead Boots | 3 | All sides gain `sticky` and +1 pip. |  |
| Abacus | 3 | Shifts the row across by 1; +1 max hp. |  |
| Iron Pendant | 3 | +1 to incoming shields. |  |
| Droopy Hat | 3 | +2 max hp; +2 max mana. |  |
| Whetstone | 3 | Basic damage sides +1. |  |
| Pocket Phylactery | 3 | Left+mid gain `pain`; +5 max hp. |  |
| Ladder | 3 | Mid replaced by the hero above's mid side. |  |
| Blood Chalice | 3 | When overhealed: gain 1 shield. |  |
| Smelly Manure | 3 | Left, mid, right, rightmost gain `decay`; top and bot gain `growth`. |  |
| Unholy Strength | 3 | Immune to healing and shields; left, mid, right, rightmost +1. |  |
| Three of a Kind | 3 | Rightmost gains `trio`. |  |
| Diving Suit | 3 | Right+rightmost replaced by the hero below's. |  |
| Poem | 3 | Top becomes 1 shield `cantrip`; mid becomes 1 shield to all; bottom becomes 1 damage `cantrip`. |  |
| Siphon | 3 | Mana sides gain `pain` and +1 pip. |  |
| Viscera | 3 | Mid becomes 0-pip damage with `flesh` and `pain`. |  |
| Learn heat | 3 | Spell (cost 3): heal 3 with `cleanse` to all heroes that have shields. | Spell |
| Antivenom | 3 | Immune to poison. |  |
| Full Moon | 3 | Every 2nd turn: all sides become wolf sides. |  |
| Fangs | 3 | Left gains `selfHeal`. |  |
| Dynamo | 3 | Right+rightmost gain `exhaust` and `era`. |  |
| Shortsword | 4 | Right+rightmost become 2 damage. |  |
| Enchanted Shield | 4 | Start of each turn: gain 1 shield. |  |
| Harpoon | 4 | Rightmost becomes 1 damage with `vulnerable`. |  |
| Pulley | 4 | Shifts the column down by 1; +2 item slots. |  |
| Learn Mark | 4 | Spell (cost 4): 2 damage with `vulnerable`. | Spell |
| Chakram | 4 | Shield sides become ranged damage (same pips). |  |
| Splitting Arrows | 4 | Right+rightmost become 1 ranged damage with `cleave`. |  |
| Hissing Ring | 4 | Mid becomes 2 damage with `poison`. |  |
| Demon Eye | 4 | Left gains `pain` and +2 pips. |  |
| Glass Blade | 4 | Left becomes 5 damage; item is discarded if wearer dies. |  |
| Learn hack | 4 | Spell (cost 2): target's blank sides become 4 damage. | Spell |
| Chainmail | 4 | +3 max hp. |  |
| Learn hex | 4 | Spell (cost 3): kill a target with exactly 6 hp (ranged); single cast. | Spell |
| Learn invest | 4 | Spell (cost 4): gain 6 mana next turn (`future`); once per turn (`cooldown`). | Spell |
| Life Bolt | 4 | After any ability is used: heal 1 (self). |  |
| Charged Skull | 4 | On death: gain 4 mana. |  |
| Apple | 4 | Left+mid gain `ego`. |  |
| Mana Jelly | 4 | Mana sides gain `exhaust` and `cantrip`. |  |
| Jester Cap | 4 | All sides replaced by the Jester hero's sides. |  |
| Ink Bottle | 4 | Blank sides become 1 shield `cantrip`. |  |
| Eyepatch | 4 | Left loses all keywords. |  |
| Red flag | 4 | +3 max hp; mid becomes a redirect-incoming (taunt) side with `cleave`. |  |
| Inner Strength | 4 | Removes all red and purple keywords from all sides. |  |
| Alembic | 4 | Mid becomes a 'give `managain` + `pain`' side (grants keywords to an ally's side). |  |
| Bonesaw | 4 | Red heroes only: top and bottom become 3 damage with `cruel`. | Colour-linked (red) |
| Shuriken | 4 | Right+rightmost gain `ranged` and `chain`. |  |
| Troll Nose | 4 | Starts with 1 regen. |  |
| Glowing Egg | 4 | Left gains `growth`. |  |
| Whiskers | 4 | Mid becomes 1 ranged damage `copycat`; right becomes 1 damage `copycat`; rightmost becomes 1 shield `copycat`. |  |
| Faerie Pact | 4 | Rightmost becomes 4 mana; -4 max hp. |  |
| Cart | 4 | All heroes +1 item slot; wearer -2 item slots. |  |
| Learn beam | 4 | Spell (cost 5): 7 ranged damage; single cast. | Spell |
| Cocoon | 4 | All sides gain `era` and -1 pip. |  |
| Pauldron | 4 | Top +2; bottom -2. |  |
| Gizmo | 4 | Right+rightmost gain `shifter`. |  |
| Cracked Plate | 5 | -4 max hp; start of each turn: gain 4 shield. |  |
| Magic Staff | 5 | Mana sides set to 2 pips. |  |
| Soup | 5 | Shield sides become heal+shield (same pips). |  |
| Tiara | 5 | Mana sides gain `selfHeal`. |  |
| Natural | 5 | Blue heroes only: right+rightmost become 2 mana. | Colour-linked (blue) |
| Dragonhide Gloves | 5 | Copies mid side onto top and bottom. |  |
| Cracked Wheel | 5 | All sides gain `sticky`; +1 reroll (party). |  |
| Shimmering Halo | 5 | When wearer saves a hero: +2 max hp (buff). |  |
| Wand Grips | 5 | Left gains `exhaust` and +2 pips. |  |
| Lens | 5 | Heal sides gain `focus`. |  |
| Decree | 5 | All sides gain `dogma`. |  |
| Erythrocyte | 5 | Mid becomes 0-pip shield with `flesh`. |  |
| Crystallise | 5 | All sides gain `stasis`. |  |
| Longsword | 5 | Left, mid, right, rightmost become 3 damage. |  |
| Demon Horn | 5 | Rightmost becomes 2 heal with `boost` and `inflictPain`. |  |
| Sack of Mana | 5 | Top blank; mid becomes 4 mana; bottom blank. |  |
| Enchanted Harp | 5 | Mid becomes 2 shield to all allies. |  |
| Fearless | 5 | +1 max hp; rightmost becomes stun. |  |
| Ordinary Triangle | 5 | Sides with exactly 3 pips get +1. |  |
| Simplicity | 5 | Basic heal, mana, damage and shield sides +1. |  |
| Glyph of Purity | 5 | Top and bottom gain `cleanse`. |  |
| Door | 5 | While 4 or more monsters are alive: shield sides +2. |  |
| Ruby | 5 | +2 to incoming healing; +2 empty hp. |  |
| Whiskey | 5 | +3 max hp; +6 empty hp. |  |
| Polished Emerald | 5 | Gains the effects of all tier 2-4 items on other heroes. |  |
| Shining Bow | 5 | All damage sides gain `ranged`. |  |
| Bag of Holding | 5 | +2 item slots; +2 max hp. |  |
| Nunchaku | 5 | Top and bottom gain `chain`. |  |
| Early Grave | 5 | Sides with 3 or more pips gain `pain` and `cantrip`. |  |
| Bandana | 5 | Pipless sides gain `cantrip`. |  |
| Determination | 5 | Turn 1 only: wearer cannot die. |  |
| Water | 5 | Left +1, mid -1, right +1, rightmost -1. |  |
| Enhance Wand | 5 | Top becomes a `exhaust` friendly 1-pip `permaBoost` shield side (+1 to all pips for the fight). |  |

## Tiers 6-9

90 items.

| Name | Tier | Effect | Notes |
|---|---|---|---|
| Sponge | 6 | When an enemy dies: all wearer's sides +1 pip for 1 turn (buff). |  |
| Blindfold | 6 | All sides lose all keywords. |  |
| Leaden Handle | 6 | Targeted sides gain `heavy` and +1 pip. |  |
| Urn | 6 | All sides gain `enduring`. |  |
| Braids | 6 | Copies left side onto mid. |  |
| Kite Shield | 6 | Shield sides set to 3 pips. |  |
| Wedding Rings | 6 | Heal sides gain `pair`. |  |
| Karma | 6 | Heal sides gain `selfHeal`; shield sides gain `selfShield`; damage sides gain `pain` (plain sides only). |  |
| Silver Pendant | 6 | +2 to incoming shields. |  |
| Ghost Shield | 6 | Start of each turn: gain 2 shield. |  |
| Wrench | 6 | Mid +1. |  |
| Blood Amulet | 6 | Left+mid gain `selfHeal`. |  |
| Catnip | 6 | Rightmost gains `cantrip`. |  |
| Tooth Necklace | 6 | Left+mid gain `cruel`. |  |
| Ocular Amulet | 6 | Left +1. |  |
| InfiniHeal | 6 | Right+rightmost become heal-all (group heal, same pips). |  |
| Blinding Bolt | 6 | After any ability is used: gain 2 shield. |  |
| Scales | 6 | Rightmost pips set to the maximum of the wearer's other sides. |  |
| Jump | 6 | Top and bottom gain all keywords from the left side; left becomes blank. |  |
| Learn Luck | 6 | Spell (cost 3): reroll 8 (`future`, once per turn). | Spell |
| Demonic Deal | 6 | All sides gain `pain` and +2 pips. |  |
| Twisted Flax | 6 | Top +1, mid -1, bottom +1. |  |
| Wand of Stun | 6 | Mid becomes stun (target with equal or less hp skips its action), `exhaust`. |  |
| Troll Blood | 6 | Starts with 2 regen. |  |
| Wooden Bracelet | 6 | Sides with no keywords +1. |  |
| Demon Claw | 6 | Left gains `rampage` and -1 pip. |  |
| Burning Halo | 6 | When wearer saves a hero: 1 damage to the whole enemy group. |  |
| Katar | 6 | Damage sides gain `trio`. |  |
| Wine | 7 | Wearer starts poisoned (1) and so do all monsters. | Affects enemies too |
| Jewel Loupe | 7 | Sides with exactly 1 pip gain `managain`. |  |
| Sparks | 7 | Sides with exactly 1 pip gain `cantrip`. |  |
| Hourglass | 7 | Turn 1 only: all sides +1. |  |
| Duck | 7 | Right+rightmost gain `echo`. |  |
| Iron Helm | 7 | +6 max hp. |  |
| Two Reeds | 7 | Even-pip sides +1. |  |
| Twisted Bar | 7 | All pipped sides set to 2. |  |
| Thimble | 7 | Immune to all damage during the wearer's own turn. |  |
| Pair of Kings | 7 | Top and bottom gain `pair`. |  |
| Ichor Chalice | 7 | When overhealed: 1 damage to the top enemy. |  |
| Second Chance | 7 | Rightmost becomes `recharge`. |  |
| Sharp Wit | 7 | Mana sides become basic damage with 3x pips; lose `managain`. |  |
| Ogre Blood | 7 | Mid gains `bloodlust`. |  |
| Dragon Pipe | 7 | Heal sides +1. |  |
| Metal Studs | 7 | Shield sides +1. |  |
| Pocket Mirror | 7 | Copies left side onto rightmost. |  |
| Mushroom | 7 | All sides gain `decay` and +1 pip. |  |
| Flute | 7 | Rightmost becomes 1 shield to all allies with `cantrip`. |  |
| Wandcraft | 7 | All sides become `exhaust` mana (keeping pips and keywords). |  |
| Broadsword | 7 | Top, mid, bottom become 4 damage. |  |
| Learn charge | 7 | Spell (cost 2): friendly target gets 2 `boost` shield; single cast. | Spell |
| Glass Heart | 7 | All sides +1; death is permanent. |  |
| Tentacle | 7 | Right+rightmost gain `thorns`. |  |
| Brimstone | 7 | Rightmost pips x3. |  |
| Egg Basket | 7 | Left +6; all other sides blank. |  |
| Ornate Hilt | 8 | Damage sides gain `selfShield`. |  |
| Boots of Speed | 8 | +1 reroll (party); left becomes dodge (self). |  |
| Holy Book | 8 | Left, mid, right, rightmost gain `cleanse` and `selfCleanse`. |  |
| Learn Spark | 8 | Spell (cost 4): friendly side gains `managain` (adds the keyword). | Spell |
| Sickle | 8 | The lowest-pip side(s) +1. |  |
| Tourmaline Paraiba | 8 | Mana sides gain `era`. |  |
| Tusk | 8 | Heal sides +1; shield sides +1. |  |
| Mirror Mask | 8 | All sides replaced by the hero above's sides. |  |
| Scorpion Tail | 8 | Top and bottom gain `weak` and `pain`. |  |
| Greatsword | 8 | Mid becomes 5 damage with `inspired`. |  |
| Deadly Bolt | 8 | After any ability is used: 1 damage to the top enemy. |  |
| Sapphire Ring | 8 | Mana sides +1. |  |
| Faerie Dust | 8 | Blank sides become 3 mana. |  |
| Singularity | 8 | Right+rightmost +2. |  |
| Iron Crown | 8 | Grey heroes only: left +4. | Colour-linked (grey) |
| Standard | 8 | Yellow heroes only: all sides +1. | Colour-linked (yellow) |
| Olympian Trident | 8 | Mid gains `cleave`. |  |
| Sushi | 8 | Left becomes 2 reroll `cantrip`. |  |
| Ironblood Pendant | 8 | +3 to incoming healing and shields. |  |
| Gauntlet | 8 | Damage sides +1. |  |
| Poison Dip | 9 | Top and bottom gain `poison`. |  |
| Serration | 9 | Top and bottom gain `vulnerable`. |  |
| Wax Seal | 9 | Each side gets +1 for every other identical side. |  |
| Boarhide Bracers | 9 | Top and bottom +2. |  |
| Timestone | 9 | Right+rightmost gain `cantrip`. |  |
| Triple Shuriken | 9 | All sides gain `ranged` and `chain`. |  |
| Collar | 9 | Top and bottom gain `copycat`. |  |
| Silk Cape | 9 | Copies left side onto left, mid, right, rightmost (row). |  |
| Emerald Mirror | 9 | Gains the effects of all tier 6-8 items on other heroes. |  |
| Horned Viper | 9 | Left+mid gain `poison`. |  |
| Dumbbell | 9 | Sides with 4 or more pips get +4. |  |
| Eye of Horus | 9 | All sides +1. |  |
| Helm of Power | 9 | Left pips x2. |  |
| Second Heart | 9 | +1 max hp per 1 base hp (doubles base hp). |  |
| Overflowing Chalice | 9 | Mid, right, rightmost gain `fizz`. |  |
| Spike Stone | 9 | Top, mid, bot, right, rightmost gain `phase` and +3 pips. |  |

## Tiers 10+

33 items.

| Name | Tier | Effect | Notes |
|---|---|---|---|
| Learn Abyss | 10 | Spell (cost 5): kill a target on half or less hp. | Spell |
| Puzzle Box | 10 | Left+mid gain `enduring`; swaps left and mid. |  |
| Antlers | 10 | Heal, shield, damage and mana sides +1. |  |
| Stream | 10 | Right gains all keywords present on any of the wearer's sides. |  |
| Mithril Shields | 10 | Shield sides (incl. keyworded) gain `cantrip`. |  |
| Full Plate | 11 | +14 max hp. |  |
| Diamond Skull | 11 | +2 max hp; on death: all allies get +1 to all sides (buff). |  |
| Poseidon Charm | 11 | Top and bottom gain `cleave`. |  |
| Bismuth | 11 | Blank sides become a 'give `copycat`' side. |  |
| Shining Emerald | 12 | Gains the effects of all tier 13-20 items on other heroes. |  |
| Broomstick | 12 | Top and bottom gain `managain`. |  |
| Locket | 12 | All sides gain `resilient`. |  |
| Ruby Shards | 12 | Heal and shield sides gain `cleave`. |  |
| Coffee | 12 | The highest-pip side(s) gain `cantrip`. |  |
| Bronze Bell | 13 | Top and bottom gain `resonate`. |  |
| Illegal | 13 | Left becomes 2 reroll `cantrip`; mid becomes `recharge`. |  |
| Ethereal Cloak | 14 | All sides become dodge (self); all hp pips become ghost hp (immune to damage when triggered). |  |
| Huge Sword | 14 | Damage sides gain `cleave`. |  |
| Fertiliser | 14 | All sides gain `growth`. |  |
| Whirlwind | 14 | Top, mid, bottom gain `cantrip`. |  |
| Golden D6 | 14 | Sets pips: left 6, mid 5, top 4, bottom 3, right 1, rightmost 2. |  |
| Third Heart | 14 | +2 max hp per 1 base hp (triples base hp). |  |
| Learn infinity | 15 | Spell (cost 13): kill any target. | Spell |
| Banned | 15 | Left gains `cleave`; mid gains `growth`. |  |
| Diamond Ring | 15 | Damage sides become heal+shield+managain (same pips). |  |
| Dolphin | 15 | All sides gain `echo`. |  |
| Emerald Satchel | 15 | Gains the effects of all unequipped (inventory) items. |  |
| Pentagram | 16 | First 5 turns: wearer cannot die. |  |
| Farewell | 16 | On death: kills the top enemy. |  |
| Blue Skink | 16 | All sides change to the hero below's side types, keeping pips and keywords. |  |
| Whirlpool | 16 | All sides gain every keyword present on the wearer's sides. |  |
| Obsidian Edge | 17 | Damage sides pips x3. |  |
| Face of Horus | 17 | All sides +2. |  |

## Keyword glossary

Short rules of the keywords used above (from `Keyword.java`):

| Keyword | Rule |
|---|---|
| `cantrip` | activates during rolling if it lands face-up, without using the hero's turn |
| `pain` | wearer takes N damage when used |
| `exert` | replaces all the wearer's sides with blanks until end of next turn |
| `mandatory` | must be used if possible |
| `sticky` | cannot be rerolled |
| `stasis` | side cannot change (other items cannot alter it) |
| `exhaust` / `doubleUse` / `quadUse` / `hyperUse` | side is replaced with a blank after use / can be used 2 / 4 / N times per turn |
| `growth` / `decay` / `undergrowth` | after use gains +1 / loses 1 pip for the fight / opposite side gains +1 |
| `ranged` | can hit back-row enemies |
| `cleave` | also hits both sides of the target |
| `cruel` | x2 vs targets on half or less hp |
| `heavy` / `eliminate` | target must have the most / least hp |
| `poison` | also inflicts N unblockable damage at end of each turn |
| `weak` / `vulnerable` | target gets -N to all pips for a turn / takes +N damage for a turn |
| `boost` / `permaBoost` | target gets +N to all pips for a turn / for the fight |
| `cleanse` | reduces target's poison, weak, petrify, inflicted effects by N |
| `thorns` | N damage to enemies attacking the target |
| `selfHeal` / `selfShield` / `selfCleanse` | wearer heals / shields / cleanses itself by N |
| `managain` | gain N mana |
| `manacost` | costs N mana to use |
| `trio`, `pair`, `quin`, `sept` | x3, x2, x5, x7 if the previous 2 / 1 / 4 / 6 dice have the same value |
| `copycat` / `echo` / `resonate` | copy the previous die's keywords / pips / effect |
| `phase` | 50% chance to be blank each turn |
| `shifter` | random extra keyword that changes each turn |
| `enduring` / `resilient` / `dogma` | keywords / pips / pips-only-change remain when the side is replaced |
| `ego` / `duel` / `wham` / `patient` / `sixth` / `tall` / `focus` / `chain` / `inspired` / `guilt` / `evil` / `lead` / `century` / `reborn` / `squared` / `zeroed` / `groupGrowth` / `inflictX` | situational bonuses or riders; see `Keyword.java` for exact text |

## Findings and caveats

- **Totals differ slightly from Analysis.md section 2.4.** The earlier count of 443 named + 27 spell/tactic = 470 matches this file. The tier histogram differs at the margins: this extraction gives t-7: 1 (Dead Crow), t-4: 3 (Backstab, Empathy, Amnesia), t0: 75 (includes Eggshell, defined in the OneFive file), t10: 5 (includes the Abyss spell, defined in the SixNine file), t15: 7. Items are not necessarily in the file that matches their tier.
- **Computed tiers.** Amnesia uses `Math.round(ModTierUtils.blanked(0.8F))` = -4 and Dead Crow `Math.round(ModTierUtils.deadHero(0.85F))` = -7.
- **Peanut Shell** (tier 0) is `ForceEquip` but not a negative tier; it grants +1 empty hp.
- **Potions** are identified by name (and the `potion` keyword on their sides). "Potion Shard" (tier 0) counts as a potion by name and discards a potion item when used.
- **Orbit, Overprepared, Tin Foil Hat** have behaviour inferred from code (see Notes); Overprepared depends on a "turn 0" requirement that may never fire.
- **Joke / no-op items**: Void, Bent Spoon, Bent Fork, Paper, Card, Grass.
- Items that copy others (Cracked/Dusty/Emerald Shard/Polished/Emerald Mirror/Shining Emerald/Satchel) apply the other heroes' item effects by tier range, so their real value depends on the party.
- Spell/tactic items name the ability; the same ability can also exist on heroes (for example Burst, Poke).

## Removed items

Items removed because their effect uses a keyword that was removed from the prototype (85).

| Name | Tier | Effect | Removed keyword(s) |
|---|---|---|---|
| Backstab | -4 | Top, mid, bot and right sides become 4 damage aimed at an ally (`mandatory`, `generous`, `stasis`). | `generous` |
| Martyr | -1 | Left+mid sides gain `death` and +2 pips. | `death` |
| Monster Grin | 0 | Top and bottom sides gain `possessed`. | `possessed` |
| Stake | 0 | All damage sides gain `terminal`. | `terminal` |
| Cyanide Pill | 0 | Right+rightmost sides gain `cantrip` and `death`. | `death` |
| Scissors | 0 | Rightmost side gains `deathwish` and `pain`. | `deathwish` |
| Learn Waste | 0 | Spell (cost 1): turn target's blank sides into 1-pip damage+`death` sides. | `death` |
| Snake Oil | 0 | Basic heal sides gain `engage`. | `engage` |
| Fidget Spinner | 0 | Mid side becomes `recharge` with `duplicate`. | `duplicate` |
| Trick Deck | 0 | Left side gains `sept`. | `sept` |
| Paper | 0 | Left side gains `nothing` (no effect). | `nothing` |
| Big Fish | 0 | Damage sides gain `vitality`. | `vitality` |
| Card | 0 | Right+rightmost sides gain `inflictInflictNothing` (inflicts the no-op `nothing`; no real effect). | `inflictInflictNothing`, `nothing` |
| Refactor | 0 | Recharge sides become a 'give doubleUse' side. | `doubleUse` |
| Chalk | 0 | Curse-blank sides become 3-pip mana with `death`. | `death` |
| Cigarette end | 0 | `exhaust` sides gain `doubleUse`. | `doubleUse` |
| Shroud | 0 | Mid side gains `reborn`. | `reborn` |
| Sleeper Agent | 0 | Rightmost becomes 5 damage aimed at an ally (`mandatory`, `generous`, `stasis`). | `generous` |
| Potion Shard | 0 | Bottom side becomes 1 damage with `pain` and `potion` (discards topmost potion item permanently). | `potion` |
| Can | 0 | Right+rightmost sides gain `century`. | `century` |
| Eggshell | 0 | Right side gains `zeroed` and -1 pip. | `zeroed` |
| Revive Potion | 1 | Right side becomes resurrect (5 hp) with `potion`. | `potion` |
| Courage Potion | 1 | Left side gains `potion` and +3 pips. | `potion` |
| Titanbane Potion | 1 | Mid gains `dispel` and `potion`. | `dispel`, `potion` |
| Doom Blade | 1 | Blank sides become 3 damage with `death`. | `death` |
| Whey | 1 | Left gains `vitality`. | `vitality` |
| Needle | 2 | Targeted sides gain `picky` and +2 pips. | `picky` |
| Blessed Water | 2 | Mid becomes 3 heal with `vitality`. | `vitality` |
| Blessed Ring | 2 | Rightmost becomes 1 shield with `rescue`. | `rescue` |
| Rain of Arrows | 2 | Top becomes 1 ranged damage with `duplicate`. | `duplicate` |
| Clef | 2 | Left+mid gain `treble`. | `treble` |
| PowerStone | 2 | Grey heroes only: mid becomes 0-pip mana with `steel`. | `steel` |
| Foil | 3 | Right becomes 0-pip damage with `skill`. | `skill` |
| Incense | 3 | Top gains `rite`. | `rite` |
| Lightning Rod | 3 | Left becomes 0-pip ranged damage with `charged`, `rampage`, `pain`. | `charged` |
| Magnet | 3 | Right+rightmost gain `wham`. | `wham` |
| Lich Finger | 3 | Left gains `managain` and `death`. | `death` |
| Aegis | 3 | Mid becomes 1 shield with `duplicate` and `steel`. | `duplicate`, `steel` |
| Ritual Dagger | 3 | Rightmost becomes 4 resurrect with `death`. | `death` |
| Mana Bomb | 3 | Rightmost becomes 0-pip damage to all with `charged`, `manacost`. | `charged` |
| Relic | 3 | All sides gain `swapTerminal` (terminal with swapped subject; inferred). | `swapTerminal` |
| Obol | 3 | Right+rightmost gain `deathwish`. | `deathwish` |
| Wristblade | 4 | Blank sides become 1 damage with `doubleUse`. | `doubleUse` |
| Corruption | 4 | Heal sides gain `evil` and +1 pip. | `evil` |
| Updog | 4 | Top gains `overdog`. | `overdog` |
| Flawed Diamond | 4 | Left+mid gain `pristine`; +4 empty hp. | `pristine` |
| Duelling Pistol | 4 | Left gains `duel`. | `duel` |
| Poodle | 5 | Top, mid, bot gain `dog`. | `dog` |
| Mini Crossbow | 5 | Top becomes 2 ranged damage with `engage`. | `engage` |
| Ambrosia | 5 | Left gains `rescue`. | `rescue` |
| Monocle | 5 | Mid gains `engage`. | `engage` |
| Justice | 5 | Damage sides gain `guilt` and +1 pip. | `guilt` |
| Treasure Chest | 5 | Left gains `hoard` and `exhaust`. | `hoard` |
| Sling | 5 | Bottom gains `underdog`. | `underdog` |
| Sceptre | 5 | Left becomes 1 damage with `lead`. | `lead` |
| Candle | 5 | All sides gain `vigil`. | `vigil` |
| Cauldron | 5 | Mid gains `rite` and +1 pip. | `rite` |
| Honeycomb | 6 | Mid, right, rightmost gain `sixth`. | `sixth` |
| Lich Eye | 6 | All sides gain `managain` and `death`, +2 pips. | `death` |
| Tie | 6 | Mid gains `pristine`. | `pristine` |
| Crescent Shield | 6 | Left becomes 1 shield with `thorns`, `rampage`, `rescue`. | `rescue` |
| Conduit | 6 | Mid becomes 2 mana with `duplicate`. | `duplicate` |
| Eucalyptus | 7 | Right becomes 1 heal with `cleanse` and `quadUse`. | `quadUse` |
| Charge Link | 7 | Top and bottom gain `charged` and `exhaust`. | `charged` |
| Anvil | 7 | Mid gains `steel`. | `steel` |
| Botany | 7 | Heal sides gain `groupGrowth`. | `groupGrowth` |
| Bullseye | 8 | Top, mid, bottom gain `engage`. | `engage` |
| Prism | 8 | Mid gains `rainbow`. | `rainbow` |
| Lion | 8 | Left+mid gain `fierce`. | `fierce` |
| Angel Feather | 9 | Top and bottom gain `rescue`. | `rescue` |
| Chaos Wand | 9 | Mid becomes 1 damage, `exhaust`, `cleave`, `engage`, `selfHeal`, `weak`, `vulnerable`. | `engage` |
| Charged Hammer | 9 | Left becomes 10 damage with `heavy` and `charged`. | `charged` |
| Shiny Gauntlets | 9 | Top and bottom gain `pristine`. | `pristine` |
| Heart of Light | 11 | Blank sides become 10 heal with `cleanse` and `quadUse`. | `quadUse` |
| Telescope | 11 | Left+mid gain `spy`. | `spy` |
| Mana Potion | 11 | Top becomes 20 mana with `potion`. | `potion` |
| Stilts | 11 | Top, mid, bottom gain `tall`. | `tall` |
| Economancy | 11 | Top, mid, bottom gain `squared`. | `squared` |
| Conjuring Rings | 12 | Top gains `duplicate`. | `duplicate` |
| Titanbane Amulet | 13 | Sides with 5 or more pips gain `dispel`. | `dispel` |
| Demon Heart | 13 | Top, mid, bottom gain `inflictInflictDeath`. | `inflictInflictDeath` |
| Archmage Orb | 15 | Mid gains `charged`. | `charged` |
| Titan Blade | 15 | Left becomes 100 damage with `death`. | `death` |
| Chocolate Bar | 16 | Damage and shield sides (incl. keyworded) gain `doubleUse`. | `doubleUse` |
| Taboo | 17 | Heal sides gain `hyperUse` (usable pips times per turn). | `hyperUse` |
