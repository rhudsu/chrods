/*
 * Guarda quanto tempo você leva, por rodada, para identificar + formar + executar
 * um acorde (do instante em que ele aparece até o acerto). Só conta tempo em
 * acertos genuínos — revelar o acorde invalida a medição daquela rodada.
 *
 * A métrica "típica" por acorde é a mediana depois de remover outliers (ver
 * stats-math.js), pra uma rodada isolada muito lenta (distração, pausa) não
 * distorcer a leitura.
 */

const TimingStore = (function () {
  const KEY = 'chordTrainerTiming_v1';
  const MAX_LOG = 200;
  const MAX_PER_CHORD = 60;

  let log = []; // [{id, ms, ts}] — mais antigo primeiro, histórico bruto (nunca filtrado)
  let perChord = {}; // id -> {times: [...], bestMs}

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      log = (d && d.log) || [];
      perChord = (d && d.perChord) || {};
    } catch (e) {
      log = [];
      perChord = {};
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ log, perChord })); } catch (e) { /* ok */ }
  }

  // Normaliza uma entrada de perChord pro formato atual — protege contra dado
  // salvo por uma versão anterior do app (ex.: formato antigo só com soma/contagem,
  // sem o array de tempos individuais).
  function normalizedEntry(id) {
    const p = perChord[id];
    if (p && Array.isArray(p.times)) return p;
    const bestMs = p && typeof p.bestMs === 'number' ? p.bestMs : null;
    return { times: [], bestMs };
  }

  function record(id, ms) {
    log.push({ id, ms, ts: Date.now() });
    if (log.length > MAX_LOG) log.shift();
    const p = normalizedEntry(id);
    p.times.push(ms);
    if (p.times.length > MAX_PER_CHORD) p.times.shift();
    p.bestMs = p.bestMs === null ? ms : Math.min(p.bestMs, ms);
    perChord[id] = p;
    save();
  }

  // Tempo "típico" (mediana sem outliers) pra esse acorde — null se nunca cronometrado.
  function chordTypicalMs(id) {
    const p = perChord[id];
    return (p && Array.isArray(p.times) && p.times.length) ? robustMedian(p.times) : null;
  }

  function chordBestMs(id) {
    const p = perChord[id];
    return p ? p.bestMs : null;
  }

  function getLog() { return log.slice(); }

  function resetAll() {
    log = [];
    perChord = {};
    save();
  }

  load();

  return { record, chordTypicalMs, chordBestMs, getLog, resetAll };
})();
