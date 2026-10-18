/**
 * Botanical illustrations for garden items. Each draws into a 100×120 box, grounded at y≈116.
 * Plants take a growth stage: 0 sprout, 1 growing, 2 full bloom.
 */
type Stage = 0 | 1 | 2;

const Leaf = ({ x, y, r, s = 1, c = '#4f8a5b' }: { x: number; y: number; r: number; s?: number; c?: string }) => (
  <path d="M0 0 C 6 -6, 16 -6, 22 0 C 16 6, 6 6, 0 0 Z" fill={c} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} />
);
const Stem = ({ h, x = 50, c = '#3f7a4c', w = 2.6, bend = 0 }: { h: number; x?: number; c?: string; w?: number; bend?: number }) => (
  <path d={`M${x} 116 Q ${x + bend} ${116 - h / 2} ${x} ${116 - h}`} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />
);
const Soil = () => <ellipse cx="50" cy="116" rx="22" ry="4" fill="#6b4f3a" opacity="0.35" />;

function Sprout({ c = '#5e9c69' }: { c?: string }) {
  return <g><Soil /><Stem h={16} c="#4d8a59" /><Leaf x={50} y={102} r={-35} s={0.6} c={c} /><Leaf x={50} y={104} r={-150} s={0.55} c={c} /></g>;
}

function Clover({ stage }: { stage: Stage }) {
  const leaf = (cx: number, cy: number, sc: number) => (
    <g transform={`translate(${cx} ${cy}) scale(${sc})`}>
      {[0, 90, 180, 270].map((a) => <path key={a} d="M0 0 C -9 -4 -10 -15 -2 -16 C 2 -16 3 -12 0 -9 C 3 -12 8 -14 9 -9 C 10 -3 4 0 0 0 Z" transform={`rotate(${a + 45})`} fill={a % 180 ? '#3f8a55' : '#4f9c63'} />)}
    </g>
  );
  if (stage === 0) return <g><Soil />{leaf(50, 108, 0.45)}</g>;
  return (
    <g>
      <Soil />
      <Stem h={18} x={42} c="#3a7a4b" bend={-3} /><Stem h={26} x={56} c="#3a7a4b" bend={3} />
      {leaf(42, 98, 0.7)}{leaf(56, 90, stage === 2 ? 0.95 : 0.8)}
      {stage === 2 && <><Stem h={14} x={30} c="#3a7a4b" />{leaf(30, 102, 0.6)}<Stem h={12} x={68} />{leaf(68, 104, 0.55)}</>}
    </g>
  );
}

function Tulip({ stage }: { stage: Stage }) {
  if (stage === 0) return <Sprout />;
  const bloom = (x: number, h: number, c: string, open: boolean) => (
    <g>
      <Stem h={h} x={x} />
      <Leaf x={x} y={116 - h * 0.35} r={-60} s={0.9} />
      <g transform={`translate(${x} ${116 - h})`}>
        {open ? (
          <><path d="M-9 0 C -10 -14 -4 -18 0 -12 C 4 -18 10 -14 9 0 C 6 6 -6 6 -9 0 Z" fill={c} /><path d="M-3 -2 C -3 -12 3 -12 3 -2 Z" fill="#fff" opacity="0.25" /></>
        ) : <path d="M-6 0 C -7 -10 -3 -14 0 -14 C 3 -14 7 -10 6 0 C 4 4 -4 4 -6 0 Z" fill={c} opacity="0.85" />}
      </g>
    </g>
  );
  return <g><Soil />{bloom(40, 46, '#e0607e', stage === 2)}{bloom(58, 56, '#f08a5d', stage === 2)}{stage === 2 && bloom(70, 40, '#e85d8a', true)}</g>;
}

function Lavender({ stage }: { stage: Stage }) {
  if (stage === 0) return <Sprout c="#7a9d7f" />;
  const spike = (x: number, h: number, lean: number) => (
    <g key={x}>
      <path d={`M${x} 116 Q ${x + lean / 2} ${116 - h / 2} ${x + lean} ${116 - h}`} stroke="#6e8f6f" strokeWidth="1.8" fill="none" />
      {Array.from({ length: stage === 2 ? 6 : 3 }, (_, i) => <ellipse key={i} cx={x + lean - (lean * i) / 12} cy={116 - h + i * 4} rx="3" ry="2.4" fill={i % 2 ? '#8e7cc3' : '#a08fd6'} />)}
    </g>
  );
  return <g><Soil />{[[38, 52, -8], [46, 62, -3], [54, 66, 2], [62, 56, 7], [50, 48, 0]].map(([x, h, l]) => spike(x, h, l))}<Leaf x={46} y={110} r={-160} s={0.6} c="#86a588" /><Leaf x={54} y={110} r={-20} s={0.6} c="#86a588" /></g>;
}

function Fern({ stage }: { stage: Stage }) {
  if (stage === 0) return <Sprout c="#4c9a5e" />;
  const frond = (rot: number, len: number) => (
    <g transform={`translate(50 114) rotate(${rot})`} key={rot}>
      <path d={`M0 0 Q 4 ${-len / 2} 0 ${-len}`} stroke="#3c7f4d" strokeWidth="1.6" fill="none" />
      {Array.from({ length: Math.floor(len / 7) }, (_, i) => (
        <g key={i}><Leaf x={1} y={-6 - i * 7} r={-20} s={0.42 - i * 0.02} c="#4c9a5e" /><Leaf x={1} y={-6 - i * 7} r={-160} s={0.42 - i * 0.02} c="#5aa86b" /></g>
      ))}
    </g>
  );
  const l = stage === 2 ? 64 : 44;
  return <g><Soil />{[-50, -25, 0, 25, 50].map((r) => frond(r, l - Math.abs(r) / 3))}</g>;
}

function Sunflower({ stage }: { stage: Stage }) {
  if (stage === 0) return <Sprout />;
  const h = stage === 2 ? 92 : 60;
  return (
    <g>
      <Soil /><Stem h={h} w={3.4} c="#4a7d3e" />
      <Leaf x={50} y={116 - h * 0.4} r={-30} s={1.1} c="#5b8f4a" /><Leaf x={50} y={116 - h * 0.6} r={-150} s={1} c="#5b8f4a" />
      <g transform={`translate(50 ${116 - h})`}>
        {stage === 2 ? <>
          {Array.from({ length: 14 }, (_, i) => <ellipse key={i} rx="4" ry="10" cy="-12" fill={i % 2 ? '#f2b630' : '#f6c64a'} transform={`rotate(${i * (360 / 14)})`} />)}
          <circle r="9" fill="#6b4524" /><circle r="5" fill="#553419" />
        </> : <circle r="7" fill="#7aa356" />}
      </g>
    </g>
  );
}

function Peony({ stage }: { stage: Stage }) {
  if (stage === 0) return <Sprout />;
  const flower = (x: number, y: number, r: number) => (
    <g transform={`translate(${x} ${y})`}>
      {stage === 2 ? [r, r * 0.75, r * 0.5].map((rr, i) => <circle key={i} r={rr} fill={['#f4a7b9', '#ef8fa6', '#e57592'][i]} />) : <circle r={r * 0.55} fill="#f1b3c1" />}
    </g>
  );
  return (
    <g><Soil />
      <Stem h={40} x={40} bend={-4} /><Stem h={52} x={56} bend={4} /><Stem h={34} x={66} />
      <Leaf x={44} y={96} r={-150} s={1} /><Leaf x={56} y={92} r={-20} s={1} /><Leaf x={60} y={104} r={-40} s={0.8} />
      {flower(40, 76, 11)}{flower(56, 64, 13)}{flower(66, 82, 9)}
    </g>
  );
}

function Monstera({ stage }: { stage: Stage }) {
  const leaf = (rot: number, sc: number) => (
    <g transform={`translate(50 112) rotate(${rot}) scale(${sc})`} key={rot}>
      <path d="M0 0 L0 -30" stroke="#2f6b3f" strokeWidth="2" />
      <path d="M0 -30 C -22 -34 -24 -62 0 -66 C 24 -62 22 -34 0 -30 Z" fill="#2f7a46" />
      <path d="M-14 -44 L -6 -46 M -16 -54 L -6 -54 M 14 -44 L 6 -46 M 16 -54 L 6 -54" stroke="#e2ecdf" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
  if (stage === 0) return <g><Soil />{leaf(0, 0.4)}</g>;
  return <g><Soil />{(stage === 2 ? [-40, -12, 18, 44] : [-20, 20]).map((r, i) => leaf(r, stage === 2 ? 0.85 + (i % 2) * 0.12 : 0.7))}</g>;
}

function Rose({ stage }: { stage: Stage }) {
  if (stage === 0) return <Sprout c="#3f7d4c" />;
  const rose = (x: number, y: number) => (
    <g transform={`translate(${x} ${y})`}>
      <circle r="8" fill="#c83a4f" /><path d="M-5 0 A5 5 0 0 1 5 0" stroke="#9c2338" strokeWidth="1.6" fill="none" /><path d="M-3 -3 A3 3 0 0 1 3 -3" stroke="#9c2338" strokeWidth="1.4" fill="none" />
    </g>
  );
  return (
    <g><Soil />
      <ellipse cx="50" cy="86" rx="30" ry="26" fill="#3c7347" /><ellipse cx="40" cy="80" rx="16" ry="14" fill="#468052" /><ellipse cx="62" cy="88" rx="16" ry="14" fill="#356b40" />
      {stage === 2 ? <>{rose(36, 76)}{rose(56, 70)}{rose(66, 90)}{rose(44, 94)}</> : <>{rose(50, 76)}</>}
    </g>
  );
}

function Tree({ stage, kind }: { stage: Stage; kind: 'maple' | 'cherry' | 'oak' }) {
  const crown = { maple: ['#d9692e', '#e88a3a', '#c4552a'], cherry: ['#f5bfd0', '#f8d3df', '#eda6bd'], oak: ['#3d7a45', '#4c8c52', '#346b3c'] }[kind];
  const s = stage === 0 ? 0.45 : stage === 1 ? 0.75 : 1;
  return (
    <g transform={`translate(50 116) scale(${s}) translate(-50 -116)`}>
      <ellipse cx="50" cy="116" rx="26" ry="4" fill="#6b4f3a" opacity="0.3" />
      <path d="M46 116 L47 70 Q 50 66 53 70 L 54 116 Z" fill="#7a5638" />
      <path d="M50 84 L 36 70 M 50 78 L 64 66" stroke="#7a5638" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="48" r="26" fill={crown[0]} /><circle cx="32" cy="60" r="17" fill={crown[1]} /><circle cx="68" cy="58" r="18" fill={crown[2]} /><circle cx="52" cy="30" r="16" fill={crown[1]} />
      {kind === 'cherry' && stage === 2 && [[38, 42], [60, 36], [66, 60], [30, 64], [50, 56]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="#fff" opacity="0.8" />)}
    </g>
  );
}

function Pond() {
  return (
    <g>
      <ellipse cx="50" cy="104" rx="44" ry="14" fill="#7a9c8a" /><ellipse cx="50" cy="103" rx="40" ry="11.5" fill="#8fc1d4" />
      <ellipse cx="38" cy="102" rx="12" ry="3" fill="#b9dde8" opacity="0.7" />
      <g fill="#4f9c63"><path d="M62 104 a7 3.5 0 1 0 0.1 0 Z" /><path d="M30 107 a6 3 0 1 0 0.1 0 Z" /></g>
      <circle cx="64" cy="101" r="2.6" fill="#f4a7c4" />
      {[14, 20, 82, 88].map((x) => <path key={x} d={`M${x} 108 Q ${x - 2} 92 ${x + 1} 84`} stroke="#5a8a54" strokeWidth="2" fill="none" />)}
    </g>
  );
}

function Pot({ kind }: { kind: 'terracotta' | 'glazed' | 'box' }) {
  if (kind === 'box') return (
    <g><rect x="14" y="88" width="72" height="26" rx="2" fill="#b07a4f" /><rect x="14" y="88" width="72" height="5" fill="#c48d60" />{[30, 50, 70].map((x) => <line key={x} x1={x} y1="93" x2={x} y2="114" stroke="#9a6842" strokeWidth="1" />)}
      {[24, 38, 52, 66, 78].map((x, i) => <g key={x}><Leaf x={x} y={88} r={-60 - i * 10} s={0.6} c="#4f9c63" /><Leaf x={x} y={88} r={-120 + i * 8} s={0.55} c="#5aa86b" /></g>)}</g>
  );
  const body = kind === 'terracotta' ? ['#c46b42', '#d98457'] : ['#2f6f5a', '#3e8a71'];
  return (
    <g>
      <path d="M30 80 L70 80 L64 116 L36 116 Z" fill={body[0]} /><rect x="27" y="74" width="46" height="9" rx="2" fill={body[1]} />
      <path d="M36 86 L40 112" stroke="#fff" strokeOpacity="0.18" strokeWidth="3" />
      <Leaf x={50} y={74} r={-70} s={0.8} c="#4f9c63" /><Leaf x={50} y={74} r={-115} s={0.75} c="#5aa86b" /><Leaf x={50} y={74} r={-30} s={0.6} c="#3f8a55" />
    </g>
  );
}

function Bench() {
  return (
    <g>
      <rect x="12" y="84" width="76" height="7" rx="2" fill="#9c6b45" /><rect x="12" y="72" width="76" height="6" rx="2" fill="#a87650" /><rect x="12" y="62" width="76" height="6" rx="2" fill="#a87650" />
      <rect x="18" y="62" width="5" height="54" fill="#4a4a48" /><rect x="77" y="62" width="5" height="54" fill="#4a4a48" />
      <rect x="18" y="98" width="64" height="3" fill="#4a4a48" />
    </g>
  );
}

function Lantern() {
  return (
    <g>
      <rect x="47" y="56" width="6" height="60" fill="#3e403d" /><rect x="40" y="110" width="20" height="6" rx="2" fill="#3e403d" />
      <path d="M38 34 L62 34 L58 58 L42 58 Z" fill="#fde7a8" stroke="#3e403d" strokeWidth="2.5" /><path d="M36 34 L50 24 L64 34 Z" fill="#3e403d" />
      <circle cx="50" cy="46" r="5" fill="#ffcf5c" /><circle cx="50" cy="46" r="14" fill="#ffd66b" opacity="0.18" />
    </g>
  );
}

function BirdBath() {
  return (
    <g>
      <path d="M44 116 L46 82 L54 82 L56 116 Z" fill="#b8b4a8" /><rect x="38" y="110" width="24" height="6" rx="2" fill="#a8a498" />
      <ellipse cx="50" cy="80" rx="28" ry="7" fill="#c9c5b9" /><ellipse cx="50" cy="78" rx="24" ry="4.5" fill="#9fcde0" />
      <g transform="translate(64 66)"><ellipse rx="7" ry="5" fill="#5f7fa8" /><circle cx="6" cy="-4" r="3.6" fill="#5f7fa8" /><path d="M9 -4 L13 -3 L9 -2 Z" fill="#e9a23b" /><path d="M-6 0 L-12 -3 L-8 2 Z" fill="#4c6a91" /></g>
    </g>
  );
}

function WateringCan() {
  return (
    <g>
      <path d="M30 116 L34 84 L66 84 L70 116 Z" fill="#5f8fa3" /><path d="M66 92 L88 74 L90 78 L70 100 Z" fill="#4f7d90" /><rect x="86" y="70" width="8" height="6" rx="1" transform="rotate(-38 90 73)" fill="#3f6b7d" />
      <path d="M38 84 Q 50 64 62 84" stroke="#3f6b7d" strokeWidth="4" fill="none" />
    </g>
  );
}

function Arbor() {
  return (
    <g>
      <path d="M18 116 L18 46 Q 50 6 82 46 L 82 116" stroke="#f1ece0" strokeWidth="6" fill="none" /><path d="M24 116 L24 48 Q 50 16 76 48 L 76 116" stroke="#e2dccd" strokeWidth="2" fill="none" />
      {[[22, 60], [30, 38], [44, 26], [58, 26], [72, 38], [80, 60], [20, 84], [80, 84]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="5" fill="#4f9c63" /><circle cx={x + 2} cy={y - 1} r="2.6" fill={i % 2 ? '#e0607e' : '#f4a7b9'} /></g>)}
    </g>
  );
}

function ThemeSwatch({ id }: { id: string }) {
  const t = THEMES[id] ?? THEMES['theme-spring'];
  return (
    <g>
      <rect x="6" y="18" width="88" height="98" rx="10" fill={t.sky[0]} /><rect x="6" y="18" width="88" height="50" rx="10" fill={t.sky[1]} opacity="0.6" />
      <circle cx="72" cy="40" r="9" fill={t.sun} />
      <path d="M6 80 Q 30 62 54 78 T 94 74 L 94 106 L 6 106 Z" fill={t.hills[0]} /><path d="M6 96 Q 40 84 94 94 L 94 106 Q 94 116 84 116 L 16 116 Q 6 116 6 106 Z" fill={t.ground[0]} />
    </g>
  );
}

function PathSwatch({ id }: { id: string }) {
  return (
    <g>
      <rect x="6" y="40" width="88" height="76" rx="10" fill="#8fbf74" />
      <PathShape id={id} transform="translate(6 40) scale(0.055 0.084)" />
    </g>
  );
}

export function ItemArt({ id, stage = 2 }: { id: string; stage?: Stage }) {
  switch (id) {
    case 'clover': return <Clover stage={stage} />;
    case 'tulip': return <Tulip stage={stage} />;
    case 'lavender': return <Lavender stage={stage} />;
    case 'fern': return <Fern stage={stage} />;
    case 'sunflower': return <Sunflower stage={stage} />;
    case 'peony': return <Peony stage={stage} />;
    case 'monstera': return <Monstera stage={stage} />;
    case 'rose': return <Rose stage={stage} />;
    case 'maple': return <Tree stage={stage} kind="maple" />;
    case 'cherry': return <Tree stage={stage} kind="cherry" />;
    case 'oak': return <Tree stage={stage} kind="oak" />;
    case 'pond': return <Pond />;
    case 'pot-terracotta': return <Pot kind="terracotta" />;
    case 'pot-glazed': return <Pot kind="glazed" />;
    case 'planter-box': return <Pot kind="box" />;
    case 'bench': return <Bench />;
    case 'lantern': return <Lantern />;
    case 'birdbath': return <BirdBath />;
    case 'watering-can': return <WateringCan />;
    case 'arbor': return <Arbor />;
    default:
      if (id.startsWith('theme-')) return <ThemeSwatch id={id} />;
      if (id.startsWith('path-')) return <PathSwatch id={id} />;
      return <Sprout />;
  }
}

export function ItemSvg({ id, stage, className }: { id: string; stage?: Stage; className?: string }) {
  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <ItemArt id={id} stage={stage} />
    </svg>
  );
}

export const THEMES: Record<string, { sky: [string, string]; sun: string; hills: [string, string]; ground: [string, string] }> = {
  'theme-spring': { sky: ['#cfe8f5', '#f3f8f1'], sun: '#ffe08a', hills: ['#a9cf8f', '#8fbf74'], ground: ['#88b96b', '#7aad5f'] },
  'theme-autumn': { sky: ['#f6dcc0', '#fbf0e3'], sun: '#f6b45a', hills: ['#d39a5b', '#b98a4f'], ground: ['#a7a05a', '#97924f'] },
  'theme-dusk': { sky: ['#b9a6d8', '#f5c6b5'], sun: '#ffc88a', hills: ['#7f8fb0', '#6c7f9e'], ground: ['#6f9a6a', '#5f8b5c'] },
  'theme-winter': { sky: ['#dfe9f2', '#f7fafc'], sun: '#fdf3d0', hills: ['#e6eef3', '#d5e1ea'], ground: ['#eef3f6', '#e1e9ee'] },
};

/** The path ribbon drawn across the lawn, in a 1600×900 scene. */
export function PathShape({ id, transform }: { id: string | null; transform?: string }) {
  if (!id) return null;
  const d = 'M700 900 C 720 760, 940 720, 880 600 C 840 520, 760 500, 800 430';
  if (id === 'path-stone') {
    const pts = [[730, 860], [770, 790], [850, 740], [900, 670], [860, 600], [800, 540], [790, 480], [810, 435]];
    return <g transform={transform}>{pts.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={48 - i * 4} ry={20 - i * 1.6} fill="#c9c3b4" stroke="#aba493" strokeWidth="3" />)}</g>;
  }
  const color = id === 'path-brick' ? '#c27a5a' : '#ddd4c0';
  return (
    <g transform={transform}>
      <path d={d} stroke={id === 'path-brick' ? '#a3604a' : '#c8bea8'} strokeWidth="132" fill="none" strokeLinecap="round" />
      <path d={d} stroke={color} strokeWidth="118" fill="none" strokeLinecap="round" />
      {id === 'path-brick' && <path d={d} stroke="#a3604a" strokeWidth="118" strokeDasharray="4 26" fill="none" opacity="0.55" />}
      {id === 'path-gravel' && <path d={d} stroke="#bfb49c" strokeWidth="100" strokeDasharray="2 14" fill="none" opacity="0.6" />}
    </g>
  );
}

export function SceneBackground({ theme, path }: { theme: string; path: string | null }) {
  const t = THEMES[theme] ?? THEMES['theme-spring'];
  return (
    <svg className="bg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.sky[0]} /><stop offset="1" stopColor={t.sky[1]} /></linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.ground[0]} /><stop offset="1" stopColor={t.ground[1]} /></linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      <circle cx="1300" cy="150" r="70" fill={t.sun} opacity="0.9" /><circle cx="1300" cy="150" r="120" fill={t.sun} opacity="0.18" />
      <g fill="#ffffff" opacity={theme === 'theme-dusk' ? 0.35 : 0.75}>
        <ellipse cx="300" cy="140" rx="90" ry="22" /><ellipse cx="360" cy="124" rx="60" ry="24" /><ellipse cx="900" cy="90" rx="70" ry="16" /><ellipse cx="950" cy="80" rx="44" ry="18" />
      </g>
      <path d="M0 420 Q 260 300 520 380 T 1040 350 T 1600 380 L 1600 900 L 0 900 Z" fill={t.hills[0]} />
      <path d="M0 470 Q 380 380 800 450 T 1600 430 L 1600 900 L 0 900 Z" fill={t.hills[1]} />
      <path d="M0 420 L 1600 420 L 1600 900 L 0 900 Z" fill="url(#ground)" opacity="0" />
      <path d="M0 400 Q 800 340 1600 400 L 1600 900 L 0 900 Z" fill="url(#ground)" transform="translate(0 40)" />
      {theme === 'theme-winter' && <g fill="#fff" opacity="0.8">{Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 397) % 1600} cy={(i * 211) % 400} r={2 + (i % 3)} />)}</g>}
      <PathShape id={path} />
      {/* fence */}
      <g stroke="#f1ece0" strokeWidth="8" opacity="0.85">
        <line x1="0" y1="430" x2="1600" y2="430" /><line x1="0" y1="456" x2="1600" y2="456" />
        {Array.from({ length: 21 }, (_, i) => <line key={i} x1={i * 80 + 20} y1="410" x2={i * 80 + 20} y2="470" />)}
      </g>
    </svg>
  );
}
