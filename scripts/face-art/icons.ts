/**
 * Vector definitions for the face icon library. `npm run face-art` renders each one to
 * public/face-art/library/<id>.webp (192x192) and writes index.json for the editor's picker.
 *
 * Style matches the original hit/guard/seep icons: flat colour tile, cream and metal shapes with a
 * dark navy outline. Drawn in a 192x192 box. Child shapes use the classes defined in `STYLE`.
 */

export const TILE = {
  red: '#e0603a', orange: '#e8873a', blue: '#3c7fd0', cyan: '#3aa7c9', green: '#4fae2f',
  purple: '#8a5ad0', gold: '#dca02a', grey: '#6f7b89', dark: '#4b3d63', pink: '#d9507a',
} as const;
export type Tile = keyof typeof TILE;

export const STYLE = `
.s{stroke:#1d2740;stroke-width:6;stroke-linejoin:round;stroke-linecap:round}
.m{fill:#dfe6f2}.w{fill:#b9794c}.g{fill:#f4c64f}.r{fill:#e5584b}.b{fill:#5aa9f0}.p{fill:#a97be3}
.n{fill:#7fd957}.c{fill:#f7ecd0}.d{fill:#1d2740}.y{fill:#fff}.o{fill:#f08a3c}.k{fill:#8d99ab}.x{fill:none}
.t{stroke-width:3}.h{stroke-width:10}
`;

export interface Icon {
  id: string;
  label: string;
  tags: string[];
  tile: Tile;
  /** SVG markup placed inside <g class="s">. */
  body: string;
}

const rot = (deg: number, inner: string) => `<g transform="rotate(${deg} 96 96)">${inner}</g>`;
const sword = (blade = 'm') => `<path class="${blade}" d="M96 14 L112 40 L108 116 L84 116 L80 40 Z"/><path class="x t" d="M96 28 L96 112"/><rect class="g" x="62" y="116" width="68" height="13" rx="6"/><rect class="w" x="88" y="129" width="16" height="28" rx="4"/><circle class="g" cx="96" cy="164" r="9"/>`;

export const ICONS: Icon[] = [
  // ---- weapons
  { id: 'dagger', label: 'Dagger', tags: ['weapon', 'knife', 'blade', 'attack', 'stab'], tile: 'red', body: rot(45,
    '<path class="m" d="M96 16 L110 46 L106 112 L86 112 L82 46 Z"/><path class="x t" d="M96 30 L96 108"/><rect class="g" x="64" y="112" width="64" height="12" rx="6"/><rect class="w" x="88" y="124" width="16" height="30" rx="4"/><circle class="g" cx="96" cy="162" r="9"/>') },
  { id: 'hammer', label: 'Hammer', tags: ['weapon', 'bash', 'smash', 'mallet', 'attack'], tile: 'red', body: rot(45,
    '<rect class="w" x="88" y="64" width="16" height="104" rx="6"/><rect class="m" x="50" y="24" width="92" height="48" rx="10"/><rect class="g" x="50" y="40" width="92" height="9"/>') },
  { id: 'axe', label: 'Axe', tags: ['weapon', 'chop', 'cleave', 'attack'], tile: 'red', body: rot(35,
    '<rect class="w" x="90" y="26" width="13" height="146" rx="6"/><path class="m" d="M103 34 Q158 26 156 72 Q154 106 103 100 Z"/><path class="m" d="M90 52 L70 58 L70 80 L90 86 Z"/>') },
  { id: 'spear', label: 'Spear', tags: ['weapon', 'pierce', 'lance', 'attack'], tile: 'red', body: rot(45,
    '<rect class="w" x="91" y="46" width="12" height="130" rx="5"/><path class="m" d="M97 10 L116 56 L97 46 L78 56 Z"/><rect class="r" x="86" y="58" width="22" height="12" rx="4"/>') },
  { id: 'bow', label: 'Bow', tags: ['weapon', 'ranged', 'arrow', 'archer', 'attack'], tile: 'orange', body:
    '<path class="x h" d="M62 20 Q156 96 62 172"/><path class="x" style="stroke:#b9794c;stroke-width:6" d="M62 20 Q156 96 62 172"/><path class="x t" d="M62 20 L62 172"/><path class="m" d="M52 96 L134 96 L124 86 M134 96 L124 106"/><path class="x" d="M52 96 L128 96"/>' },
  { id: 'arrow', label: 'Arrow', tags: ['weapon', 'ranged', 'shot', 'attack', 'pierce'], tile: 'orange', body: rot(-45,
    '<rect class="w" x="91" y="40" width="10" height="112" rx="4"/><path class="m" d="M96 10 L116 48 L76 48 Z"/><path class="r" d="M96 150 L120 176 L96 168 L72 176 Z"/>') },
  { id: 'club', label: 'Club', tags: ['weapon', 'bludgeon', 'bash', 'attack'], tile: 'red', body: rot(40,
    '<path class="w" d="M84 168 L88 100 Q60 80 74 44 Q96 16 120 44 Q134 80 106 100 L110 168 Z"/><path class="x t" d="M92 60 L100 60 M88 80 L106 80"/>') },
  { id: 'mace', label: 'Mace', tags: ['weapon', 'spiked', 'bludgeon', 'attack'], tile: 'red', body: rot(40,
    '<rect class="w" x="88" y="90" width="16" height="82" rx="6"/><circle class="m" cx="96" cy="64" r="34"/><path class="m" d="M96 14 L104 32 L88 32 Z M146 64 L128 56 L128 72 Z M46 64 L64 56 L64 72 Z M96 114 L88 96 L104 96 Z"/><circle class="g" cx="96" cy="64" r="10"/>') },
  { id: 'whip', label: 'Whip', tags: ['weapon', 'lash', 'crack', 'attack'], tile: 'orange', body:
    '<path class="x h" d="M54 158 Q40 100 92 100 Q146 100 128 54 Q120 34 146 28"/><path class="x" style="stroke:#b9794c;stroke-width:5" d="M54 158 Q40 100 92 100 Q146 100 128 54 Q120 34 146 28"/><rect class="g" x="40" y="150" width="30" height="22" rx="8" transform="rotate(-20 55 161)"/><path class="x t" d="M150 24 L166 14 M152 36 L170 36" />' },
  { id: 'kris', label: 'Kris (wavy dagger)', tags: ['weapon', 'curvy', 'dagger', 'blade', 'wavy', 'attack'], tile: 'red', body: rot(45,
    '<path class="m" d="M96 10 Q110 28 98 44 Q86 60 100 78 Q112 94 100 112 L84 112 Q94 92 82 76 Q68 58 82 42 Q92 26 96 10 Z"/><rect class="g" x="66" y="112" width="60" height="12" rx="6"/><rect class="w" x="88" y="124" width="16" height="30" rx="4"/><circle class="g" cx="96" cy="162" r="9"/>') },
  { id: 'scythe', label: 'Scythe', tags: ['weapon', 'reaper', 'harvest', 'attack'], tile: 'dark', body: rot(-15,
    '<rect class="w" x="104" y="26" width="12" height="150" rx="5"/><path class="m" d="M110 30 Q60 18 34 62 Q70 44 110 58 Z"/>') },
  { id: 'claw', label: 'Claw', tags: ['weapon', 'scratch', 'slash', 'beast', 'attack'], tile: 'red', body:
    '<path class="c" d="M46 24 Q70 96 54 168 Q96 110 82 24 Z"/><path class="c" d="M84 22 Q108 96 92 170 Q134 112 120 22 Z"/><path class="c" d="M122 24 Q146 96 130 168 Q172 110 158 24 Z"/>' },
  { id: 'fist', label: 'Fist', tags: ['punch', 'brawl', 'hit', 'attack', 'unarmed'], tile: 'red', body:
    '<path class="c" d="M56 96 Q54 60 78 58 L78 52 Q80 34 100 36 Q114 26 128 40 Q146 40 146 62 L146 112 Q146 150 112 154 L82 154 Q56 148 56 120 Z"/><path class="x" d="M78 58 L78 98 M104 44 L104 94 M128 40 L128 94"/>' },
  { id: 'bomb', label: 'Bomb', tags: ['explosive', 'blast', 'fuse', 'simple bomb', 'attack', 'single cast'], tile: 'orange', body:
    '<circle class="d" cx="92" cy="112" r="50"/><path class="x" stroke="#fff" stroke-width="6" d="M62 98 Q66 82 82 76" opacity=".7"/><rect class="m" x="80" y="52" width="28" height="18" rx="4"/><path class="x" style="stroke:#b9794c;stroke-width:6" d="M108 56 Q130 40 140 24"/><path class="g" d="M140 12 L148 28 L164 22 L152 34 L162 48 L146 40 L136 52 L138 36 L124 28 L138 26 Z"/>' },
  { id: 'dart', label: 'Dart', tags: ['weapon', 'throw', 'thrown', 'ranged', 'attack'], tile: 'orange', body: rot(-40,
    '<path class="m" d="M96 14 L108 56 L84 56 Z"/><rect class="m" x="92" y="56" width="8" height="56" rx="3"/><path class="r" d="M96 110 L122 150 L96 138 L70 150 Z"/>') },
  { id: 'rock', label: 'Thrown rock', tags: ['stone', 'throw', 'sling', 'attack', 'boulder'], tile: 'grey', body:
    '<path class="k" d="M40 120 L52 74 L94 50 L140 62 L158 108 L134 150 L84 158 Z"/><path class="x t" d="M52 74 L84 96 L140 62 M84 96 L84 158 M84 96 L158 108"/>' },
  { id: 'trident', label: 'Trident', tags: ['weapon', 'three prongs', 'spear', 'sea', 'attack'], tile: 'cyan', body:
    '<rect class="w" x="90" y="68" width="12" height="108" rx="5"/><path class="m" d="M52 22 L52 74 Q52 98 96 98 Q140 98 140 74 L140 22 L124 56 L124 74 L104 74 L104 18 L88 18 L88 74 L68 74 L68 56 Z"/>' },
  { id: 'flail', label: 'Flail', tags: ['weapon', 'chain', 'spiked ball', 'attack'], tile: 'red', body:
    '<rect class="w" x="40" y="118" width="16" height="56" rx="6" transform="rotate(35 48 146)"/><path class="x h" d="M64 126 Q90 100 116 82"/><path class="x" style="stroke:#8d99ab;stroke-width:5" d="M64 126 Q90 100 116 82"/><circle class="k" cx="132" cy="64" r="28"/><path class="k" d="M132 24 L138 40 L126 40 Z M172 64 L156 58 L156 70 Z M132 104 L126 88 L138 88 Z"/>' },
  { id: 'katana', label: 'Katana', tags: ['weapon', 'sword', 'curved', 'blade', 'attack'], tile: 'red', body: rot(45,
    '<path class="m" d="M102 8 Q118 56 108 118 L90 118 Q96 60 102 8 Z"/><ellipse class="g" cx="99" cy="123" rx="22" ry="8"/><rect class="d" x="91" y="130" width="16" height="34" rx="4"/><path class="x" stroke="#f4c64f" stroke-width="3" d="M92 138 L106 146 M92 148 L106 156"/>') },
  { id: 'shuriken', label: 'Shuriken', tags: ['weapon', 'throwing star', 'ninja', 'ranged', 'attack'], tile: 'dark', body:
    '<path class="m" d="M96 14 L112 78 L178 96 L112 114 L96 178 L80 114 L14 96 L80 78 Z"/><circle class="d" cx="96" cy="96" r="12"/>' },
  { id: 'crossed_swords', label: 'Crossed swords', tags: ['weapon', 'duel', 'battle', 'attack', 'double'], tile: 'red', body:
    `${rot(45, '<path class="m" d="M96 10 L108 36 L105 112 L87 112 L84 36 Z"/><rect class="g" x="68" y="112" width="56" height="11" rx="5"/><rect class="w" x="89" y="123" width="14" height="26" rx="4"/>')}${rot(-45, '<path class="m" d="M96 10 L108 36 L105 112 L87 112 L84 36 Z"/><rect class="g" x="68" y="112" width="56" height="11" rx="5"/><rect class="w" x="89" y="123" width="14" height="26" rx="4"/>')}` },
  { id: 'sickle', label: 'Sickle', tags: ['weapon', 'curved', 'harvest', 'attack'], tile: 'dark', body: rot(20,
    '<rect class="w" x="88" y="96" width="14" height="76" rx="6"/><path class="m" d="M95 100 Q30 90 40 40 Q64 66 120 64 Q150 70 140 100 Q120 108 95 100 Z"/>') },
  { id: 'fang', label: 'Fang', tags: ['bite', 'tooth', 'beast', 'venom', 'attack'], tile: 'green', body:
    '<path class="c" d="M40 36 Q96 18 152 36 Q146 100 126 160 Q112 110 96 70 Q80 110 66 160 Q46 100 40 36 Z"/>' },
  { id: 'stinger', label: 'Stinger', tags: ['sting', 'insect', 'venom', 'needle', 'attack'], tile: 'green', body:
    '<path class="g" d="M70 18 L124 18 Q146 60 108 112 L108 168 L96 182 L84 168 L84 112 Q46 60 70 18 Z"/><path class="x t" d="M76 44 L118 44 M82 70 L112 70"/>' },
  { id: 'crossbow', label: 'Crossbow', tags: ['weapon', 'ranged', 'bolt', 'attack'], tile: 'orange', body:
    '<rect class="w" x="86" y="44" width="20" height="134" rx="6"/><path class="x h" d="M22 66 Q96 20 170 66"/><path class="x" style="stroke:#b9794c;stroke-width:6" d="M22 66 Q96 20 170 66"/><path class="x t" d="M22 66 L96 112 L170 66"/><path class="m" d="M96 26 L106 52 L86 52 Z"/>' },
  { id: 'boomerang', label: 'Boomerang', tags: ['weapon', 'thrown', 'return', 'attack'], tile: 'orange', body:
    '<path class="g" d="M30 40 Q120 24 160 100 L150 112 Q104 70 52 70 Z"/><path class="x t" d="M52 70 L30 40"/>' },
  { id: 'spiked_ball', label: 'Spiked ball', tags: ['spikes', 'thorns', 'caltrop', 'attack'], tile: 'red', body:
    '<circle class="k" cx="96" cy="96" r="42"/><path class="m" d="M96 14 L108 56 L84 56 Z M96 178 L84 136 L108 136 Z M14 96 L56 84 L56 108 Z M178 96 L136 108 L136 84 Z M38 38 L72 62 L62 72 Z M154 154 L120 130 L130 120 Z M154 38 L130 62 L120 72 Z M38 154 L62 130 L72 120 Z"/>' },
  { id: 'cleaver', label: 'Cleaver', tags: ['weapon', 'chop', 'butcher', 'heavy', 'attack'], tile: 'red', body: rot(30,
    '<path class="m" d="M60 20 L138 20 L138 106 L100 106 L60 80 Z"/><circle class="d" cx="118" cy="40" r="8"/><rect class="w" x="96" y="106" width="16" height="64" rx="6"/>') },

  // ---- defence
  { id: 'buckler', label: 'Round shield', tags: ['shield', 'buckler', 'block', 'defend', 'guard', 'round'], tile: 'blue', body:
    '<circle class="b" cx="96" cy="96" r="64"/><circle class="m" cx="96" cy="96" r="22"/><circle class="x" cx="96" cy="96" r="44" stroke-width="4"/><circle class="g" cx="96" cy="96" r="9"/>' },
  { id: 'tower_shield', label: 'Tower shield', tags: ['shield', 'heavy', 'block', 'defend', 'guard'], tile: 'blue', body:
    '<path class="b" d="M52 18 L140 18 L140 120 Q140 162 96 178 Q52 162 52 120 Z"/><path class="x t" d="M96 18 L96 176 M52 70 L140 70"/><path class="g" d="M96 18 L140 18 L140 70 L96 70 Z M52 70 L96 70 L96 176 Q52 162 52 120 Z"/>' },
  { id: 'cracked_shield', label: 'Cracked shield', tags: ['shield', 'broken', 'vulnerable', 'damaged', 'weak defence'], tile: 'blue', body:
    '<path class="b" d="M46 22 L146 22 L146 108 Q146 156 96 176 Q46 156 46 108 Z"/><path class="x" stroke-width="6" d="M96 22 L84 62 L110 82 L88 110 L104 140 L96 176"/>' },
  { id: 'helmet', label: 'Helmet', tags: ['armor', 'head', 'knight', 'defend', 'guard'], tile: 'blue', body:
    '<path class="m" d="M44 108 Q40 42 96 34 Q152 42 148 108 L148 142 L112 142 L112 118 L80 118 L80 142 L44 142 Z"/><rect class="d" x="60" y="86" width="72" height="14" rx="5"/><path class="r" d="M96 14 Q120 20 118 46 L96 34 Z"/>' },
  { id: 'armor', label: 'Chestplate', tags: ['armor', 'body', 'defend', 'guard', 'protect'], tile: 'blue', body:
    '<path class="m" d="M60 28 L82 22 Q96 36 110 22 L132 28 L158 54 L138 80 L136 164 L56 164 L54 80 L34 54 Z"/><path class="x t" d="M96 40 L96 164 M60 100 L132 100"/>' },
  { id: 'gauntlet', label: 'Gauntlet', tags: ['armor', 'glove', 'fist', 'defend', 'block'], tile: 'blue', body:
    '<path class="m" d="M52 90 L52 60 Q52 46 66 46 L70 46 L70 36 Q70 24 84 24 Q98 24 98 36 Q112 30 120 44 Q134 44 134 60 L134 112 Q134 140 108 146 L108 170 L66 170 L66 140 Q52 126 52 90 Z"/><path class="x t" d="M70 66 L70 96 M98 40 L98 94 M120 48 L120 94"/>' },
  { id: 'boot_dash', label: 'Dash (boot)', tags: ['foot', 'boot', 'speed', 'dash', 'run', 'dust', 'dodge'], tile: 'blue', body:
    '<path class="w" d="M90 28 L128 28 L128 94 L158 118 Q164 136 148 142 L82 142 L82 100 Q70 62 90 28 Z"/><rect class="d" x="78" y="142" width="80" height="14" rx="5"/><path class="x" d="M20 74 L56 74 M10 96 L50 96 M24 118 L58 118"/><circle class="c" cx="40" cy="156" r="10"/><circle class="c" cx="62" cy="164" r="7"/>' },
  { id: 'cloak', label: 'Cloak', tags: ['cape', 'hood', 'stealth', 'cover', 'defend'], tile: 'green', body:
    '<path class="p" d="M96 18 Q132 22 138 58 L166 168 Q96 150 26 168 L54 58 Q60 22 96 18 Z"/><path class="x" d="M96 44 L96 140"/><path class="g" d="M84 52 L108 52 L96 70 Z"/>' },
  { id: 'brick_wall', label: 'Wall', tags: ['barrier', 'brick', 'defend', 'fortify', 'block'], tile: 'blue', body:
    '<rect class="r" x="26" y="42" width="140" height="108" rx="6"/><path class="x" d="M26 78 L166 78 M26 114 L166 114 M72 42 L72 78 M120 42 L120 78 M50 78 L50 114 M98 78 L98 114 M144 78 L144 114 M72 114 L72 150 M120 114 L120 150"/>' },
  { id: 'dodge', label: 'Dodge (swirl)', tags: ['evade', 'avoid', 'sidestep', 'swirl', 'miss'], tile: 'cyan', body:
    '<path class="x h" d="M150 70 Q150 36 108 36 Q54 36 54 90 Q54 140 104 140 Q140 140 140 108 Q140 84 114 84"/><path class="x" stroke="#fff" stroke-width="5" d="M150 70 Q150 36 108 36 Q54 36 54 90 Q54 140 104 140 Q140 140 140 108 Q140 84 114 84"/><path class="c" d="M150 52 L168 76 L136 76 Z"/>' },
  { id: 'shield_spikes', label: 'Spiked shield', tags: ['thorns', 'spikes', 'retaliate', 'shield', 'block'], tile: 'blue', body:
    '<path class="b" d="M52 40 L140 40 L140 112 Q140 148 96 164 Q52 148 52 112 Z"/><path class="m" d="M52 40 L36 24 L66 40 Z M96 40 L96 14 L108 40 Z M140 40 L158 24 L126 40 Z M52 112 L24 118 L52 92 Z M140 112 L168 118 L140 92 Z"/>' },
  { id: 'barrier', label: 'Barrier dome', tags: ['dome', 'force field', 'ward', 'protect', 'block'], tile: 'cyan', body:
    '<path class="y" style="fill-opacity:.35" d="M24 150 Q24 40 96 40 Q168 40 168 150 Z"/><path class="x" stroke="#fff" stroke-width="5" d="M56 150 Q56 74 96 74 Q136 74 136 150"/><path class="c" d="M84 112 L108 112 L108 150 L84 150 Z"/>' },
  { id: 'sword_shield', label: 'Sword and shield', tags: ['damage', 'block', 'attack', 'defend', 'both', 'combo', 'sword and shield'], tile: 'blue', body:
    `<path class="b" d="M70 70 L152 70 L152 120 Q152 154 111 168 Q70 154 70 120 Z"/>${rot(35, '<path class="m" d="M96 8 L108 32 L105 104 L87 104 L84 32 Z"/><rect class="g" x="68" y="104" width="56" height="11" rx="5"/><rect class="w" x="89" y="115" width="14" height="24" rx="4"/>')}` },
  { id: 'shield_flame', label: 'Flame shield', tags: ['fire', 'shield', 'burn', 'block', 'retaliate'], tile: 'orange', body:
    '<path class="b" d="M52 40 L140 40 L140 112 Q140 148 96 164 Q52 148 52 112 Z"/><path class="o" d="M96 62 Q118 86 110 108 Q122 104 124 90 Q142 120 124 140 Q96 160 68 140 Q54 116 76 92 Q78 104 86 106 Q82 84 96 62 Z"/>' },
  { id: 'shield_snow', label: 'Frost shield', tags: ['ice', 'shield', 'cold', 'block', 'freeze'], tile: 'cyan', body:
    '<path class="b" d="M52 40 L140 40 L140 112 Q140 148 96 164 Q52 148 52 112 Z"/><path class="x" stroke="#fff" stroke-width="6" d="M96 62 L96 138 M64 80 L128 120 M128 80 L64 120"/>' },

  // ---- status and effects
  { id: 'flame', label: 'Flame', tags: ['fire', 'burn', 'heat', 'ignite'], tile: 'orange', body:
    '<path class="o" d="M96 14 Q130 52 120 84 Q140 78 144 56 Q176 100 158 138 Q138 176 96 176 Q54 176 38 138 Q28 106 54 74 Q56 94 72 100 Q60 56 96 14 Z"/><path class="g" d="M96 96 Q116 120 110 140 Q104 156 96 156 Q82 156 80 140 Q78 120 96 96 Z"/>' },
  { id: 'snowflake', label: 'Snowflake', tags: ['ice', 'frost', 'freeze', 'cold', 'chill'], tile: 'cyan', body:
    '<path class="x h" stroke="#1d2740" d="M96 20 L96 172 M30 58 L162 134 M162 58 L30 134"/><path class="x" stroke="#fff" stroke-width="5" d="M96 20 L96 172 M30 58 L162 134 M162 58 L30 134"/><path class="x" stroke="#fff" stroke-width="5" d="M80 34 L96 48 L112 34 M80 158 L96 144 L112 158 M44 78 L64 76 L56 58 M148 114 L128 116 L136 134 M148 78 L128 76 L136 58 M44 114 L64 116 L56 134"/>' },
  { id: 'lightning', label: 'Lightning', tags: ['shock', 'electric', 'storm', 'zap', 'bolt'], tile: 'gold', body:
    '<path class="g" d="M112 10 L48 104 L88 104 L72 182 L146 82 L102 82 Z"/>' },
  { id: 'skull', label: 'Skull', tags: ['death', 'kill', 'doom', 'curse', 'danger'], tile: 'dark', body:
    '<path class="c" d="M96 20 Q156 22 156 84 Q156 108 138 120 L138 152 L54 152 L54 120 Q36 108 36 84 Q36 22 96 20 Z"/><circle class="d" cx="70" cy="90" r="16"/><circle class="d" cx="122" cy="90" r="16"/><path class="d" d="M96 106 L106 126 L86 126 Z"/><path class="x" d="M76 152 L76 134 M96 152 L96 134 M116 152 L116 134"/>' },
  { id: 'eye', label: 'Eye', tags: ['watch', 'see', 'gaze', 'mark', 'target', 'vision'], tile: 'purple', body:
    '<path class="c" d="M14 96 Q96 22 178 96 Q96 170 14 96 Z"/><circle class="p" cx="96" cy="96" r="34"/><circle class="d" cx="96" cy="96" r="16"/><circle class="y" cx="104" cy="88" r="6"/>' },
  { id: 'sleep', label: 'Sleep (zzz)', tags: ['stun', 'rest', 'zzz', 'daze', 'doze'], tile: 'purple', body:
    '<path class="c" d="M36 42 L96 42 L36 104 L96 104 L96 118 L28 118 L28 106 L84 54 L36 54 Z"/><path class="c" d="M108 82 L150 82 L108 126 L150 126 L150 138 L98 138 L98 128 L134 92 L108 92 Z"/><path class="c" d="M132 30 L160 30 L132 60 L160 60 L160 68 L122 68 L122 60 L146 38 L132 38 Z"/>' },
  { id: 'chain', label: 'Chain', tags: ['bind', 'restrain', 'lock', 'link', 'root'], tile: 'grey', body:
    `${rot(-45, '<rect class="m" x="68" y="14" width="56" height="70" rx="28"/><rect class="x" x="82" y="28" width="28" height="42" rx="14"/>')}${rot(-45, '<rect class="k" x="68" y="108" width="56" height="70" rx="28"/><rect class="x" x="82" y="122" width="28" height="42" rx="14"/>')}` },
  { id: 'web', label: 'Web', tags: ['spider', 'slow', 'trap', 'snare', 'entangle'], tile: 'grey', body:
    '<path class="x" stroke-width="5" d="M96 18 L96 174 M24 56 L168 136 M168 56 L24 136"/><path class="x" stroke-width="5" d="M96 52 L130 76 L134 116 L96 140 L58 116 L62 76 Z M96 84 L112 94 L112 110 L96 120 L80 110 L80 94 Z"/>' },
  { id: 'thorns', label: 'Thorn vine', tags: ['plant', 'bramble', 'spikes', 'retaliate', 'thorns'], tile: 'green', body:
    '<path class="x h" d="M30 150 Q60 70 100 100 Q140 130 160 40"/><path class="x" style="stroke:#7fd957;stroke-width:5" d="M30 150 Q60 70 100 100 Q140 130 160 40"/><path class="m" d="M52 108 L38 94 L62 98 Z M80 90 L84 66 L96 90 Z M110 112 L132 104 L118 126 Z M140 96 L164 98 L146 116 Z M118 66 L102 52 L126 56 Z"/>' },
  { id: 'broken_sword', label: 'Broken sword', tags: ['weak', 'weaken', 'snapped', 'damage down', 'feeble'], tile: 'purple', body:
    rot(45, '<path class="m" d="M96 14 L108 38 L104 78 L92 66 L98 90 L86 88 L84 38 Z"/><path class="m" d="M86 104 L98 96 L106 112 L106 120 L86 120 Z"/><rect class="g" x="62" y="120" width="68" height="12" rx="6"/><rect class="w" x="88" y="132" width="16" height="26" rx="4"/><circle class="g" cx="96" cy="164" r="9"/>') },
  { id: 'hourglass', label: 'Hourglass', tags: ['time', 'wait', 'exert', 'tired', 'delay', 'cooldown'], tile: 'gold', body:
    '<rect class="w" x="46" y="18" width="100" height="16" rx="6"/><rect class="w" x="46" y="158" width="100" height="16" rx="6"/><path class="y" style="fill-opacity:.55" d="M58 34 L134 34 Q134 80 104 96 Q134 112 134 158 L58 158 Q58 112 88 96 Q58 80 58 34 Z"/><path class="g" d="M72 50 L120 50 Q116 72 96 84 Q76 72 72 50 Z M70 150 Q78 120 96 112 Q114 120 122 150 Z"/>' },
  { id: 'sparkle', label: 'Sparkle', tags: ['magic', 'cantrip', 'shine', 'glitter', 'free'], tile: 'purple', body:
    '<path class="c" d="M92 14 Q98 74 158 80 Q98 88 92 148 Q86 88 26 80 Q86 74 92 14 Z"/><path class="g" d="M150 118 Q152 142 176 144 Q152 148 150 172 Q148 148 124 144 Q148 142 150 118 Z"/><path class="g" d="M40 128 Q42 146 58 148 Q42 150 40 168 Q38 150 22 148 Q38 146 40 128 Z"/>' },
  { id: 'heart', label: 'Heart', tags: ['health', 'life', 'heal', 'love', 'hp'], tile: 'pink', body:
    '<path class="r" d="M96 164 Q18 112 28 66 Q38 28 74 32 Q92 36 96 54 Q100 36 118 32 Q154 28 164 66 Q174 112 96 164 Z"/><path class="x" stroke="#fff" stroke-width="6" opacity=".7" d="M52 66 Q56 52 70 50"/>' },
  { id: 'cross_plus', label: 'Plus cross', tags: ['heal', 'medic', 'health', 'cure', 'add', 'plus'], tile: 'green', body:
    '<path class="c" d="M70 20 L122 20 L122 70 L172 70 L172 122 L122 122 L122 172 L70 172 L70 122 L20 122 L20 70 L70 70 Z"/>' },
  { id: 'bone', label: 'Bone', tags: ['skeleton', 'undead', 'remains', 'death'], tile: 'dark', body: rot(45,
    '<path class="c" d="M70 44 Q50 38 52 22 Q70 8 90 22 Q96 28 96 28 Q96 28 102 22 Q122 8 140 22 Q142 38 122 44 L122 148 Q142 154 140 170 Q122 184 102 170 Q96 164 96 164 Q96 164 90 170 Q70 184 52 170 Q50 154 70 148 Z"/>') },
  { id: 'mushroom', label: 'Mushroom', tags: ['fungus', 'spore', 'nature', 'poison', 'toadstool'], tile: 'green', body:
    '<path class="c" d="M76 90 L116 90 L122 164 L70 164 Z"/><path class="r" d="M20 98 Q20 30 96 28 Q172 30 172 98 Q96 112 20 98 Z"/><circle class="y" cx="62" cy="68" r="11"/><circle class="y" cx="104" cy="52" r="9"/><circle class="y" cx="136" cy="80" r="10"/>' },
  { id: 'leaf', label: 'Leaf', tags: ['nature', 'plant', 'growth', 'regen', 'green'], tile: 'green', body:
    '<path class="n" d="M32 160 Q20 54 150 26 Q176 120 80 154 Z"/><path class="x" d="M32 160 Q80 110 130 56 M70 120 L58 92 M92 98 L84 70 M104 120 L130 118"/>' },
  { id: 'feather', label: 'Feather', tags: ['light', 'quick', 'air', 'bird', 'quill'], tile: 'cyan', body: rot(30,
    '<path class="c" d="M96 12 Q150 50 130 112 Q116 150 96 178 Q76 150 62 112 Q42 50 96 12 Z"/><path class="x" d="M96 22 L96 180 M96 60 L124 84 M96 84 L66 104 M96 110 L120 128"/>') },
  { id: 'wing', label: 'Wing', tags: ['fly', 'swift', 'angel', 'bird', 'evade'], tile: 'cyan', body:
    '<path class="c" d="M24 150 Q14 70 70 38 Q120 12 170 24 Q150 44 156 56 Q136 64 142 80 Q122 86 126 104 Q106 108 106 128 Q84 130 70 150 Q50 160 24 150 Z"/><path class="x" d="M70 38 Q60 90 70 150 M110 28 Q98 80 106 128"/>' },
  { id: 'star', label: 'Star', tags: ['favourite', 'bonus', 'rank', 'special', 'favorite'], tile: 'gold', body:
    '<path class="g" d="M96 14 L118 68 L176 72 L132 110 L146 168 L96 136 L46 168 L60 110 L16 72 L74 68 Z"/>' },
  { id: 'moon', label: 'Moon', tags: ['night', 'dark', 'lunar', 'dream', 'crescent'], tile: 'dark', body:
    '<path class="c" d="M128 22 Q60 28 56 98 Q54 160 124 172 Q70 176 44 130 Q22 80 58 46 Q88 18 128 22 Z"/><path class="g" d="M146 56 L152 70 L166 72 L156 82 L158 96 L146 88 L134 96 L136 82 L126 72 L140 70 Z"/>' },
  { id: 'sun', label: 'Sun', tags: ['light', 'day', 'radiant', 'holy', 'bright'], tile: 'gold', body:
    '<circle class="g" cx="96" cy="96" r="38"/><path class="o" d="M96 14 L108 46 L84 46 Z M96 178 L84 146 L108 146 Z M14 96 L46 84 L46 108 Z M178 96 L146 108 L146 84 Z M38 38 L66 56 L56 66 Z M154 154 L126 136 L136 126 Z M154 38 L136 66 L126 56 Z M38 154 L56 126 L66 136 Z"/>' },
  { id: 'bell', label: 'Bell', tags: ['ring', 'alarm', 'sound', 'call', 'chime'], tile: 'gold', body:
    '<path class="g" d="M96 24 Q142 26 146 84 L150 130 L170 148 L22 148 L42 130 L46 84 Q50 26 96 24 Z"/><circle class="d" cx="96" cy="164" r="14"/><circle class="g" cx="96" cy="18" r="8"/>' },
  { id: 'key', label: 'Key', tags: ['unlock', 'open', 'treasure', 'lock', 'access'], tile: 'gold', body: rot(-45,
    '<circle class="g" cx="96" cy="46" r="32"/><circle class="d" cx="96" cy="46" r="12"/><rect class="g" x="88" y="76" width="16" height="96" rx="5"/><path class="g" d="M104 128 L132 128 L132 144 L104 144 Z M104 152 L124 152 L124 166 L104 166 Z"/>') },
  { id: 'coin', label: 'Coin', tags: ['gold', 'money', 'shop', 'buy', 'treasure', 'pay'], tile: 'gold', body:
    '<circle class="g" cx="96" cy="96" r="64"/><circle class="x" cx="96" cy="96" r="44"/><path class="d" d="M96 66 L104 88 L126 88 L108 102 L116 124 L96 110 L76 124 L84 102 L66 88 L88 88 Z"/>' },
  { id: 'dice', label: 'Die', tags: ['luck', 'roll', 'random', 'chance', 'cube', 'dice'], tile: 'red', body:
    '<rect class="c" x="30" y="30" width="132" height="132" rx="26"/><circle class="d" cx="66" cy="66" r="11"/><circle class="d" cx="126" cy="66" r="11"/><circle class="d" cx="96" cy="96" r="11"/><circle class="d" cx="66" cy="126" r="11"/><circle class="d" cx="126" cy="126" r="11"/>' },
  { id: 'gem', label: 'Gem', tags: ['jewel', 'crystal', 'treasure', 'precious', 'diamond'], tile: 'cyan', body:
    '<path class="y" d="M52 28 L140 28 L178 74 L96 176 L14 74 Z"/><path class="b" d="M52 28 L72 74 L14 74 Z M140 28 L178 74 L120 74 Z M72 74 L96 176 L120 74 Z"/><path class="x t" d="M52 28 L72 74 L96 28 L120 74 L140 28 M72 74 L120 74"/>' },
  { id: 'potion', label: 'Potion', tags: ['flask', 'drink', 'elixir', 'brew', 'bottle'], tile: 'purple', body:
    '<path class="y" d="M76 20 L116 20 L116 74 L156 150 Q162 172 138 172 L54 172 Q30 172 36 150 L76 74 Z"/><path class="p" d="M52 122 L140 122 L156 150 Q162 172 138 172 L54 172 Q30 172 36 150 Z"/><rect class="w" x="72" y="10" width="48" height="16" rx="6"/>' },
  { id: 'scroll', label: 'Scroll', tags: ['spell', 'paper', 'letter', 'magic', 'text'], tile: 'gold', body:
    '<path class="c" d="M50 36 L150 36 L150 150 L50 150 Z"/><circle class="c" cx="50" cy="36" r="14"/><circle class="c" cx="150" cy="150" r="14"/><path class="x" d="M70 62 L130 62 M70 84 L130 84 M70 106 L130 106"/>' },
  { id: 'book', label: 'Book', tags: ['spellbook', 'knowledge', 'tome', 'learn', 'read'], tile: 'purple', body:
    '<path class="r" d="M34 32 L96 44 L158 32 L158 150 L96 164 L34 150 Z"/><path class="c" d="M44 40 L94 50 L94 152 L44 142 Z M148 40 L98 50 L98 152 L148 142 Z"/><path class="x t" d="M96 44 L96 164"/>' },
  { id: 'hand', label: 'Open hand', tags: ['grab', 'palm', 'stop', 'touch', 'hand'], tile: 'orange', body:
    '<path class="c" d="M52 108 L40 70 Q36 56 50 52 Q62 50 66 62 L72 82 L72 36 Q72 22 86 22 Q100 22 100 36 L100 74 L104 28 Q106 16 118 18 Q132 20 130 34 L124 78 L134 44 Q140 32 152 38 Q162 44 156 58 L140 110 Q128 160 88 164 Q60 160 52 130 Z"/>' },
  { id: 'spiral', label: 'Spiral', tags: ['dizzy', 'confuse', 'hypnosis', 'swirl', 'vortex'], tile: 'purple', body:
    '<path class="x h" d="M96 96 Q96 78 114 78 Q138 78 138 102 Q138 134 102 134 Q58 134 58 94 Q58 46 106 46 Q158 46 158 100"/><path class="x" stroke="#fff" stroke-width="5" d="M96 96 Q96 78 114 78 Q138 78 138 102 Q138 134 102 134 Q58 134 58 94 Q58 46 106 46 Q158 46 158 100"/>' },
  { id: 'target', label: 'Target', tags: ['aim', 'bullseye', 'focus', 'mark', 'precision'], tile: 'red', body:
    '<circle class="c" cx="96" cy="96" r="68"/><circle class="r" cx="96" cy="96" r="48"/><circle class="c" cx="96" cy="96" r="28"/><circle class="r" cx="96" cy="96" r="10"/>' },
  { id: 'gear', label: 'Gear', tags: ['machine', 'mechanism', 'tune', 'settings', 'cog'], tile: 'grey', body:
    '<path class="m" d="M82 14 L110 14 L114 34 L132 42 L148 30 L168 50 L156 66 L164 84 L182 88 L182 112 L164 116 L156 134 L168 150 L148 170 L132 158 L114 166 L110 186 L82 186 L78 166 L60 158 L44 170 L24 150 L36 134 L28 116 L10 112 L10 88 L28 84 L36 66 L24 50 L44 30 L60 42 L78 34 Z" transform="translate(0 -4) scale(.98) translate(2 4)"/><circle class="d" cx="96" cy="100" r="22"/>' },
  { id: 'anvil', label: 'Anvil', tags: ['forge', 'smith', 'upgrade', 'craft', 'workshop'], tile: 'grey', body:
    '<path class="k" d="M20 54 L172 54 Q170 92 126 94 L126 118 L148 142 L148 162 L44 162 L44 142 L66 118 L66 94 Q30 90 20 54 Z"/><path class="x t" d="M70 54 L70 94"/>' },
  { id: 'flag', label: 'Banner', tags: ['flag', 'rally', 'standard', 'inspire', 'victory'], tile: 'red', body:
    '<rect class="w" x="42" y="16" width="12" height="160" rx="5"/><path class="r" d="M54 26 L162 26 L138 66 L162 106 L54 106 Z"/><circle class="g" cx="48" cy="16" r="9"/>' },
  { id: 'crown', label: 'Crown', tags: ['king', 'royal', 'boss', 'elite', 'rule'], tile: 'gold', body:
    '<path class="g" d="M26 138 L18 56 L66 92 L96 40 L126 92 L174 56 L166 138 Z"/><rect class="g" x="26" y="138" width="140" height="24" rx="6"/><circle class="r" cx="96" cy="118" r="9"/>' },
  { id: 'horn', label: 'War horn', tags: ['call', 'signal', 'rally', 'sound', 'trumpet'], tile: 'gold', body:
    '<path class="c" d="M24 110 L24 80 L96 72 Q146 60 174 22 L174 168 Q146 130 96 118 Z"/><rect class="g" x="14" y="74" width="26" height="42" rx="8"/><path class="x t" d="M110 66 L110 124"/>' },
  { id: 'cauldron', label: 'Cauldron', tags: ['brew', 'cook', 'witch', 'potion', 'bubble', 'poison'], tile: 'green', body:
    '<path class="d" d="M30 80 L162 80 Q170 150 126 166 L66 166 Q22 150 30 80 Z"/><ellipse class="n" cx="96" cy="80" rx="66" ry="16"/><circle class="n" cx="74" cy="48" r="11"/><circle class="n" cx="106" cy="34" r="8"/><circle class="n" cx="124" cy="56" r="7"/><rect class="d" x="48" y="164" width="20" height="14" rx="4"/><rect class="d" x="124" y="164" width="20" height="14" rx="4"/>' },
  { id: 'wave', label: 'Wave', tags: ['water', 'sea', 'tide', 'flow', 'flood'], tile: 'cyan', body:
    '<path class="y" d="M16 112 Q40 70 70 100 Q96 130 122 90 Q150 50 176 92 L176 160 L16 160 Z"/><path class="b" d="M16 134 Q40 100 70 124 Q96 148 122 118 Q150 90 176 120 L176 164 L16 164 Z"/>' },
  { id: 'wind', label: 'Wind', tags: ['air', 'gust', 'breeze', 'push', 'speed'], tile: 'cyan', body:
    '<path class="x h" d="M20 66 L110 66 Q144 66 144 40 Q144 20 122 22 M20 100 L146 100 Q176 100 176 126 Q176 150 150 148 M20 134 L84 134 Q108 134 108 154 Q108 170 90 168"/><path class="x" stroke="#fff" stroke-width="5" d="M20 66 L110 66 Q144 66 144 40 Q144 20 122 22 M20 100 L146 100 Q176 100 176 126 Q176 150 150 148 M20 134 L84 134 Q108 134 108 154 Q108 170 90 168"/>' },
  { id: 'spider', label: 'Spider', tags: ['arachnid', 'bug', 'web', 'venom', 'creepy'], tile: 'dark', body:
    '<path class="x h" d="M96 92 L38 56 L22 82 M96 98 L28 100 L18 134 M96 104 L34 142 L40 176 M96 92 L154 56 L170 82 M96 98 L164 100 L174 134 M96 104 L158 142 L152 176"/><ellipse class="d" cx="96" cy="124" rx="34" ry="40"/><circle class="d" cx="96" cy="76" r="22"/><circle class="r" cx="88" cy="72" r="5"/><circle class="r" cx="104" cy="72" r="5"/>' },
  { id: 'snake', label: 'Snake', tags: ['serpent', 'venom', 'reptile', 'bite', 'coil'], tile: 'green', body:
    '<path class="x h" d="M60 168 Q20 168 36 130 Q56 96 100 112 Q150 128 150 86 Q150 52 112 54"/><path class="x" stroke="#7fd957" stroke-width="7" d="M60 168 Q20 168 36 130 Q56 96 100 112 Q150 128 150 86 Q150 52 112 54"/><circle class="n" cx="106" cy="50" r="22"/><circle class="d" cx="100" cy="44" r="4"/><path class="x" stroke="#e5584b" stroke-width="4" d="M126 58 L144 66 M144 66 L152 60 M144 66 L152 74"/>' },
  { id: 'bat', label: 'Bat', tags: ['flying', 'night', 'creature', 'vampire', 'swoop'], tile: 'dark', body:
    '<path class="d" d="M96 62 L108 44 L112 66 Q150 40 178 54 Q164 78 168 96 Q146 90 138 104 Q124 94 112 108 L96 140 L80 108 Q68 94 54 104 Q46 90 24 96 Q28 78 14 54 Q42 40 80 66 L84 44 Z"/><circle class="r" cx="88" cy="72" r="4"/><circle class="r" cx="104" cy="72" r="4"/>' },
  { id: 'bug', label: 'Bug', tags: ['beetle', 'insect', 'gnat', 'critter', 'pest'], tile: 'green', body:
    '<path class="x h" d="M60 76 L28 50 M60 100 L22 100 M60 124 L28 152 M132 76 L164 50 M132 100 L170 100 M132 124 L164 152"/><ellipse class="n" cx="96" cy="108" rx="40" ry="52"/><circle class="n" cx="96" cy="52" r="22"/><path class="x" d="M96 62 L96 160"/><circle class="d" cx="88" cy="48" r="4"/><circle class="d" cx="104" cy="48" r="4"/>' },
  { id: 'sad_face', label: 'Sad face', tags: ['weak', 'weaken', 'sad', 'frown', 'unhappy', 'debuff'], tile: 'purple', body:
    '<circle class="g" cx="96" cy="96" r="68"/><circle class="d" cx="72" cy="82" r="9"/><circle class="d" cx="120" cy="82" r="9"/><path class="x" d="M66 132 Q96 106 126 132"/><path class="b" d="M122 98 Q132 112 124 122 Q114 112 122 98 Z"/>' },
  { id: 'blank', label: 'Blank', tags: ['empty', 'nothing', 'none', 'unused', 'inert'], tile: 'grey', body:
    '<circle class="x" cx="96" cy="96" r="54" stroke-dasharray="14 12"/><circle class="d" cx="96" cy="96" r="6"/>' },
  { id: 'question', label: 'Question mark', tags: ['unknown', 'mystery', 'random', 'help', '?'], tile: 'purple', body:
    '<path class="c" d="M64 64 Q66 24 100 24 Q140 26 138 62 Q136 84 114 98 Q104 106 104 120 L82 120 Q80 94 102 78 Q114 70 114 60 Q112 46 98 46 Q86 48 86 64 Z"/><circle class="c" cx="93" cy="150" r="14"/>' },
  { id: 'exclaim', label: 'Exclamation', tags: ['warning', 'alert', 'danger', 'notice', '!'], tile: 'orange', body:
    '<path class="c" d="M68 22 L124 22 L116 112 L76 112 Z"/><circle class="c" cx="96" cy="148" r="17"/>' },
  { id: 'arrow_up', label: 'Arrow up', tags: ['buff', 'increase', 'boost', 'strengthen', 'rise', 'up'], tile: 'green', body:
    '<path class="n" d="M96 16 L162 92 L120 92 L120 170 L72 170 L72 92 L30 92 Z"/>' },
  { id: 'arrow_down', label: 'Arrow down', tags: ['debuff', 'decrease', 'weaken', 'lower', 'reduce', 'down'], tile: 'purple', body:
    '<path class="p" d="M96 176 L30 100 L72 100 L72 22 L120 22 L120 100 L162 100 Z"/>' },

  // ---- combos
  { id: 'sword_drop', label: 'Poisoned sword', tags: ['poison', 'venom', 'sword', 'damage', 'toxic blade'], tile: 'green', body:
    `${rot(40, sword())}<path class="n" d="M142 100 Q168 134 150 158 Q132 176 114 158 Q100 134 142 100 Z"/><circle class="y" cx="132" cy="140" r="5"/>` },
  { id: 'sword_flame', label: 'Flaming sword', tags: ['fire', 'burn', 'sword', 'damage', 'blaze'], tile: 'orange', body:
    `${rot(40, sword())}<path class="o" d="M138 100 Q160 124 152 150 Q142 170 124 160 Q110 140 120 128 Q128 138 134 134 Q130 118 138 100 Z"/>` },
  { id: 'sword_snow', label: 'Frost sword', tags: ['ice', 'cold', 'sword', 'damage', 'freeze', 'slow'], tile: 'cyan', body:
    `${rot(40, sword())}<path class="x" stroke="#fff" stroke-width="6" d="M138 110 L138 158 M118 124 L158 144 M158 124 L118 144"/>` },
  { id: 'dagger_drop', label: 'Venom dagger', tags: ['poison', 'venom', 'dagger', 'stab', 'toxic'], tile: 'green', body:
    `${rot(40, '<path class="m" d="M96 16 L110 46 L106 112 L86 112 L82 46 Z"/><rect class="g" x="64" y="112" width="64" height="12" rx="6"/><rect class="w" x="88" y="124" width="16" height="30" rx="4"/><circle class="g" cx="96" cy="162" r="9"/>')}<path class="n" d="M140 96 Q164 128 148 150 Q132 168 116 150 Q104 128 140 96 Z"/>` },
  { id: 'hammer_crack', label: 'Cracking hammer', tags: ['hammer', 'vulnerable', 'break', 'smash', 'impact', 'shatter'], tile: 'orange', body:
    `${rot(-35, '<rect class="w" x="88" y="64" width="16" height="108" rx="6"/><rect class="m" x="50" y="24" width="92" height="48" rx="10"/><rect class="g" x="50" y="40" width="92" height="9"/>')}<path class="x" stroke-width="5" d="M118 168 L128 150 L116 140 L132 124 M150 160 L160 148"/>` },
  { id: 'bomb_spark', label: 'Sparking bomb', tags: ['bomb', 'fuse', 'explosion', 'single cast', 'blast'], tile: 'red', body:
    '<circle class="d" cx="88" cy="116" r="52"/><rect class="m" x="76" y="56" width="26" height="16" rx="4"/><path class="x" style="stroke:#b9794c;stroke-width:6" d="M102 60 Q118 44 132 38"/><path class="g" d="M134 18 L144 32 L160 28 L150 42 L160 56 L144 50 L132 62 L134 44 L120 36 L134 34 Z"/><path class="x" stroke="#fff" stroke-width="6" opacity=".6" d="M58 100 Q62 84 80 78"/>' },
];
