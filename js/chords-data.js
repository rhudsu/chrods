/*
 * Base de dados de acordes: notas, formas abertas e formas de pestana (movíveis).
 * Gera uma biblioteca completa de "voicings" (formas específicas de tocar um acorde)
 * com as casas (trastes), dedos e as classes de altura (pitch classes) resultantes,
 * usadas tanto para desenhar o diagrama quanto para a detecção por áudio.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Grafia alternativa (bemol) para exibir nomes mais familiares quando aplicável.
const FLAT_NAME = {
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
};

// Classe de altura (0=C ... 11=B) de cada corda solta, da 6ª (Mi grave) à 1ª (Mi agudo).
const STRING_OPEN_PITCH_CLASS = [4, 9, 2, 7, 11, 4]; // E A D G B e
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];

function noteIndex(name) {
  return NOTE_NAMES.indexOf(name);
}

function displayRootName(root) {
  const flat = FLAT_NAME[root];
  return flat ? `${root}/${flat}` : root;
}

function displayChordName(root, quality) {
  const suffix = quality === 'min' ? 'm' : '';
  const flat = FLAT_NAME[root];
  const sharpLabel = `${root}${suffix}`;
  return flat ? `${sharpLabel}/${flat}${suffix}` : sharpLabel;
}

// --- Formas abertas (sem pestana) -------------------------------------------------
// frets: 6ª->1ª corda. 'x' = não tocar, 0 = corda solta, N = casa N.
const OPEN_SHAPES = [
  { root: 'E', quality: 'maj', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  { root: 'E', quality: 'min', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  { root: 'A', quality: 'maj', frets: ['x', 0, 2, 2, 2, 0], fingers: ['x', 0, 1, 2, 3, 0] },
  { root: 'A', quality: 'min', frets: ['x', 0, 2, 2, 1, 0], fingers: ['x', 0, 2, 3, 1, 0] },
  { root: 'D', quality: 'maj', frets: ['x', 'x', 0, 2, 3, 2], fingers: ['x', 'x', 0, 1, 3, 2] },
  { root: 'D', quality: 'min', frets: ['x', 'x', 0, 2, 3, 1], fingers: ['x', 'x', 0, 2, 3, 1] },
  { root: 'G', quality: 'maj', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  { root: 'C', quality: 'maj', frets: ['x', 3, 2, 0, 1, 0], fingers: ['x', 3, 2, 0, 1, 0] },
];

// --- Formas de pestana movíveis (relativas à casa da pestana = offset 0) ----------
const BARRE_SHAPES = {
  E_maj: {
    frets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1],
    barre: { fromIdx: 0, toIdx: 5 }, rootStringPc: STRING_OPEN_PITCH_CLASS[0],
  },
  E_min: {
    frets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1],
    barre: { fromIdx: 0, toIdx: 5 }, rootStringPc: STRING_OPEN_PITCH_CLASS[0],
  },
  A_maj: {
    frets: ['x', 0, 2, 2, 2, 0], fingers: ['x', 1, 2, 3, 4, 1],
    barre: { fromIdx: 1, toIdx: 5 }, rootStringPc: STRING_OPEN_PITCH_CLASS[1],
  },
  A_min: {
    frets: ['x', 0, 2, 2, 1, 0], fingers: ['x', 1, 3, 4, 2, 1],
    barre: { fromIdx: 1, toIdx: 5 }, rootStringPc: STRING_OPEN_PITCH_CLASS[1],
  },
};

const VOICING_LABELS = {
  open: 'Aberto (sem pestana)',
  barreE: 'Pestana — base Mi (6ª corda)',
  barreA: 'Pestana — base Lá (5ª corda)',
};

// Quão "parecida" é a forma física de um acorde com a de outro — usado para
// variar menos entre formas no modo de aprendizagem (ex.: F pestana base Mi
// está perto de G pestana base Mi, mas longe de C aberto).
function chordShapeDistance(a, b) {
  if (a.id === b.id) return 0;
  let d = 0;
  if (a.voicingType === b.voicingType) {
    if (a.baseFret != null && b.baseFret != null) {
      d += Math.min(2, Math.abs(a.baseFret - b.baseFret) / 3);
    }
  } else {
    d += 3;
  }
  if (a.quality !== b.quality) d += 1;
  return d;
}

function computePitchClasses(frets) {
  const set = new Set();
  frets.forEach((f, i) => {
    if (f === 'x') return;
    const pc = (STRING_OPEN_PITCH_CLASS[i] + f) % 12;
    set.add(pc);
  });
  return Array.from(set).sort((a, b) => a - b);
}

function makeVoicing({ root, quality, voicingType, frets, fingers, barre, baseFret }) {
  const id = `${root}_${quality}_${voicingType}`;
  return {
    id,
    root,
    quality, // 'maj' | 'min'
    voicingType, // 'open' | 'barreE' | 'barreA'
    voicingLabel: VOICING_LABELS[voicingType],
    frets,
    fingers,
    barre, // { fret, fromIdx, toIdx } | null
    baseFret,
    displayName: displayChordName(root, quality),
    rootDisplay: displayRootName(root),
    pitchClasses: computePitchClasses(frets),
  };
}

function barreFretForRoot(root, shapeRootPc) {
  return (noteIndex(root) - shapeRootPc + 12) % 12;
}

function buildBarreVoicing(root, quality, shapeKey) {
  const shape = BARRE_SHAPES[shapeKey];
  const fret = barreFretForRoot(root, shape.rootStringPc);
  if (fret === 0) return null; // degenera na forma aberta equivalente, já coberta
  const frets = shape.frets.map((f) => (f === 'x' ? 'x' : f + fret));
  const barre = { fret, fromIdx: shape.barre.fromIdx, toIdx: shape.barre.toIdx };
  return { frets, fingers: shape.fingers.slice(), barre, baseFret: fret };
}

function generateChordLibrary() {
  const lib = [];

  OPEN_SHAPES.forEach((s) => {
    lib.push(makeVoicing({
      root: s.root,
      quality: s.quality,
      voicingType: 'open',
      frets: s.frets.slice(),
      fingers: s.fingers.slice(),
      barre: null,
      baseFret: 1,
    }));
  });

  NOTE_NAMES.forEach((root) => {
    ['maj', 'min'].forEach((quality) => {
      const eShapeKey = quality === 'maj' ? 'E_maj' : 'E_min';
      const built = buildBarreVoicing(root, quality, eShapeKey);
      if (built) {
        lib.push(makeVoicing({ root, quality, voicingType: 'barreE', ...built }));
      }
      const aShapeKey = quality === 'maj' ? 'A_maj' : 'A_min';
      const builtA = buildBarreVoicing(root, quality, aShapeKey);
      if (builtA) {
        lib.push(makeVoicing({ root, quality, voicingType: 'barreA', ...builtA }));
      }
    });
  });

  return lib;
}

const CHORD_LIBRARY = generateChordLibrary();
const CHORD_BY_ID = Object.fromEntries(CHORD_LIBRARY.map((c) => [c.id, c]));

// --- Grupos pré-definidos -----------------------------------------------------
const PRESET_GROUPS = [
  {
    id: 'open_basic',
    name: 'Acordes abertos básicos',
    desc: 'E, Em, A, Am, D, Dm, G, C — o ponto de partida para quem está começando.',
    match: (c) => c.voicingType === 'open',
  },
  {
    id: 'barreE_maj',
    name: 'Pestana maior — base Mi',
    desc: 'Forma do E maior arrastada pelo braço. Cobre F, F#, G... até D#.',
    match: (c) => c.voicingType === 'barreE' && c.quality === 'maj',
  },
  {
    id: 'barreE_min',
    name: 'Pestana menor — base Mi',
    desc: 'Forma do Em arrastada pelo braço.',
    match: (c) => c.voicingType === 'barreE' && c.quality === 'min',
  },
  {
    id: 'barreA_maj',
    name: 'Pestana maior — base Lá',
    desc: 'Forma do A maior arrastada pelo braço. Cobre Bb, B, C... até G#.',
    match: (c) => c.voicingType === 'barreA' && c.quality === 'maj',
  },
  {
    id: 'barreA_min',
    name: 'Pestana menor — base Lá',
    desc: 'Forma do Am arrastada pelo braço.',
    match: (c) => c.voicingType === 'barreA' && c.quality === 'min',
  },
  {
    id: 'barre_easy',
    name: 'Pestana fácil (até a 5ª casa)',
    desc: 'Todas as pestanas (maiores e menores) até a 5ª casa — boas para começar a treinar pestana.',
    match: (c) => c.barre && c.barre.fret <= 5,
  },
  {
    id: 'all_major',
    name: 'Todos os maiores',
    desc: 'Todas as formas maiores da biblioteca (abertas + pestana).',
    match: (c) => c.quality === 'maj',
  },
  {
    id: 'all_minor',
    name: 'Todos os menores',
    desc: 'Todas as formas menores da biblioteca (abertas + pestana).',
    match: (c) => c.quality === 'min',
  },
  {
    id: 'everything',
    name: 'Tudo',
    desc: 'A biblioteca inteira — 52 formas diferentes.',
    match: () => true,
  },
];
