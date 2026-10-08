/* Liga a interface (seleção de acordes, tela de prática, estatísticas) à lógica do jogo. */

let selectedIds = new Set();
let currentTargetPCs = [];
let autoAdvanceTimer = null;
let liveTimerInterval = null;
let sessionComparisonShown = false;

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

// --- Preferência: medir tempo de formação -----------------------------------
function isTimingEnabled() {
  const el = document.getElementById('timingEnabledCheckbox');
  return !el || el.checked;
}

function loadTimingEnabled() {
  try { return localStorage.getItem('chordTrainerTimingEnabled_v1') !== 'false'; } catch (e) { return true; }
}

// --- Conquistas já celebradas (pra não repetir o mesmo "dominado" de novo) --
function loadMasteredSet() {
  try { return new Set(JSON.parse(localStorage.getItem('chordTrainerMasteredSeen_v1')) || []); } catch (e) { return new Set(); }
}
function saveMasteredSet(set) {
  try { localStorage.setItem('chordTrainerMasteredSeen_v1', JSON.stringify(Array.from(set))); } catch (e) { /* ok */ }
}
let masteredSeen = loadMasteredSet();

// --- Seleção de acordes ------------------------------------------------------
function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem('chordTrainerPool_v1'));
    if (Array.isArray(saved) && saved.length) {
      selectedIds = new Set(saved.filter((id) => CHORD_BY_ID[id]));
      return;
    }
  } catch (e) { /* ignora e usa padrão */ }
  selectedIds = new Set(CHORD_LIBRARY.filter((c) => c.voicingType === 'open').map((c) => c.id));
}

function saveSelection() {
  try { localStorage.setItem('chordTrainerPool_v1', JSON.stringify(Array.from(selectedIds))); } catch (e) { /* ok */ }
}

function setSelection(ids) { selectedIds = new Set(ids); saveSelection(); refreshSelectionUI(); }
function addToSelection(ids) { ids.forEach((id) => selectedIds.add(id)); saveSelection(); refreshSelectionUI(); }
function removeFromSelection(ids) { ids.forEach((id) => selectedIds.delete(id)); saveSelection(); refreshSelectionUI(); }
function toggleSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
  saveSelection();
  refreshSelectionUI();
}

function refreshSelectionUI() {
  document.querySelectorAll('.chord-chip').forEach((chip) => {
    chip.classList.toggle('selected', selectedIds.has(chip.dataset.id));
  });
  const count = selectedIds.size;
  document.getElementById('selectionCount').textContent = `${count} acorde${count === 1 ? '' : 's'} selecionado${count === 1 ? '' : 's'}`;
  document.getElementById('startTrainingBtn').disabled = count === 0;
}

function buildPresetGrid() {
  const grid = document.getElementById('presetGrid');
  grid.innerHTML = '';
  PRESET_GROUPS.forEach((preset) => {
    const ids = CHORD_LIBRARY.filter(preset.match).map((c) => c.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'preset-card';
    card.innerHTML = `<strong>${preset.name}</strong><span>${preset.desc}</span><em>${ids.length} acordes</em>`;
    card.addEventListener('click', () => setSelection(ids));
    grid.appendChild(card);
  });
}

function buildChordPicker() {
  const container = document.getElementById('chordPicker');
  container.innerHTML = '';
  const sections = [
    { type: 'open', title: 'Abertos (sem pestana)' },
    { type: 'barreE', title: 'Pestana — base Mi' },
    { type: 'barreA', title: 'Pestana — base Lá' },
  ];
  sections.forEach((sec) => {
    const chords = CHORD_LIBRARY.filter((c) => c.voicingType === sec.type);
    const wrap = document.createElement('div');
    wrap.className = 'chord-section';

    const header = document.createElement('div');
    header.className = 'chord-section-header';
    header.innerHTML = `<h3>${sec.title}</h3>`;

    const selAllBtn = document.createElement('button');
    selAllBtn.type = 'button';
    selAllBtn.className = 'link-btn';
    selAllBtn.textContent = 'selecionar todos';
    selAllBtn.addEventListener('click', () => addToSelection(chords.map((c) => c.id)));

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'link-btn';
    clearBtn.textContent = 'limpar';
    clearBtn.addEventListener('click', () => removeFromSelection(chords.map((c) => c.id)));

    header.appendChild(selAllBtn);
    header.appendChild(clearBtn);
    wrap.appendChild(header);

    const chipRow = document.createElement('div');
    chipRow.className = 'chip-row';
    chords.forEach((c) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chord-chip';
      chip.dataset.id = c.id;
      chip.textContent = c.displayName + (c.barre ? ` (${c.baseFret}ª)` : '');
      chip.addEventListener('click', () => toggleSelection(c.id));
      chipRow.appendChild(chip);
    });
    wrap.appendChild(chipRow);
    container.appendChild(wrap);
  });
}

// --- Tabs ---------------------------------------------------------------------
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab !== 'play') stopPractice();
  if (tab === 'stats') renderStatsTable();
}

function stopPractice() {
  clearAutoAdvanceTimer();
  stopLiveTimer();
  SessionStore.finalizeCurrent();
  if (PitchDetector.isListening()) PitchDetector.stop();
  document.getElementById('gameArea').classList.add('hidden');
  document.getElementById('micSetup').classList.remove('hidden');
  document.getElementById('micError').innerHTML = '';
}

// --- Cronômetro ao vivo (identificação + formação + execução) -------------------
function stopLiveTimer() {
  if (liveTimerInterval) {
    clearInterval(liveTimerInterval);
    liveTimerInterval = null;
  }
}

function startLiveTimer(startedAt) {
  stopLiveTimer();
  const el = document.getElementById('liveTimer');
  if (!isTimingEnabled()) {
    el.className = 'live-timer hidden';
    return;
  }
  el.className = 'live-timer';
  el.textContent = '0.0s';
  liveTimerInterval = setInterval(() => {
    el.textContent = formatSeconds(performance.now() - startedAt);
  }, 100);
}

// --- Microfone ------------------------------------------------------------------
function beginSession() {
  document.getElementById('micSetup').classList.add('hidden');
  document.getElementById('gameArea').classList.remove('hidden');
  Game.init(Array.from(selectedIds));
  SessionStore.startNewSession();
  sessionComparisonShown = false;
}

async function attemptStartMic() {
  const micError = document.getElementById('micError');
  micError.innerHTML = '';
  UiSound.init();
  try {
    if (!PitchDetector.isListening()) await PitchDetector.start();
    beginSession();
  } catch (err) {
    micError.innerHTML = `Não consegui acessar o microfone (${err.message || err}). Verifique a permissão do navegador para este site/arquivo. `;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'link-btn';
    btn.textContent = 'Continuar sem microfone';
    btn.addEventListener('click', beginSession);
    micError.appendChild(btn);
  }
}

// --- Medidor de chroma ao vivo ---------------------------------------------------
function buildChromaMeter() {
  const el = document.getElementById('chromaMeter');
  el.innerHTML = '';
  NOTE_NAMES.forEach((name, i) => {
    const bar = document.createElement('div');
    bar.className = 'chroma-bar';
    bar.dataset.pc = String(i);
    bar.innerHTML = `<div class="chroma-fill"></div><span class="chroma-label">${name}</span>`;
    el.appendChild(bar);
  });
}

PitchDetector.onFrame(({ chroma, volume }) => {
  const bars = document.querySelectorAll('.chroma-bar');
  bars.forEach((bar, i) => {
    const fill = bar.querySelector('.chroma-fill');
    const pct = Math.min(100, Math.round(chroma[i] * 140));
    fill.style.height = `${pct}%`;
    bar.classList.toggle('chroma-target', currentTargetPCs.includes(i));
  });
  const volFill = document.getElementById('volumeFill');
  if (volFill) volFill.style.width = `${Math.min(100, Math.round(volume * 400))}%`;
});

// --- Avançar automaticamente ------------------------------------------------
function clearAutoAdvanceTimer() {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  const fill = document.getElementById('autoAdvanceFill');
  if (fill) {
    fill.style.transition = 'none';
    fill.style.width = '0%';
  }
}

function scheduleAutoAdvance() {
  const checkbox = document.getElementById('autoAdvanceCheckbox');
  if (!checkbox || !checkbox.checked) return;
  const DELAY_MS = 1800;
  const fill = document.getElementById('autoAdvanceFill');
  if (fill) {
    fill.style.transition = 'none';
    fill.style.width = '0%';
    void fill.offsetWidth; // força o reflow para a transição reiniciar do zero
    fill.style.transition = `width ${DELAY_MS}ms linear`;
    fill.style.width = '100%';
  }
  autoAdvanceTimer = setTimeout(() => {
    autoAdvanceTimer = null;
    Game.nextRound();
  }, DELAY_MS);
}

// --- Modo de variação (aprendizagem / progressivo / prática livre) --------------
const MODE_INFO = {
  learning: { desc: 'Varia pouco: repete a mesma forma (base Mi, base Lá ou aberto), trocando a nota, pra fixar o shape.' },
  progressive: { desc: 'Começa parecido com o Aprendizagem e vai ficando mais variado ao longo da sessão.' },
  practice: { desc: 'Sorteio totalmente aleatório entre os acordes escolhidos.' },
};

function loadMode() {
  try {
    const saved = localStorage.getItem('chordTrainerMode_v1');
    if (saved && MODE_INFO[saved]) return saved;
  } catch (e) { /* ok */ }
  return 'progressive';
}

function setMode(m) {
  Game.setMode(m);
  try { localStorage.setItem('chordTrainerMode_v1', m); } catch (e) { /* ok */ }
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  document.getElementById('modeDesc').textContent = MODE_INFO[m].desc;
  updateModeProgress(Game.getVariability());
}

function updateModeProgress(variability) {
  const bar = document.getElementById('modeProgressFill');
  const wrap = document.getElementById('modeProgress');
  if (!bar || !wrap) return;
  const mode = Game.getMode();
  if (mode === 'progressive') {
    wrap.classList.remove('hidden');
    bar.style.width = `${Math.round(variability * 100)}%`;
  } else {
    wrap.classList.add('hidden');
  }
}

// --- Jogo: reações da interface --------------------------------------------------
function updateScoreBar() {
  const s = Game.getSession();
  document.getElementById('scoreCorrect').textContent = s.correct;
  document.getElementById('streak').textContent = s.streak;
  document.getElementById('accuracy').textContent = s.total ? `${Math.round((s.correct / s.total) * 100)}%` : '—';
}

function showDiagram(chord) {
  document.getElementById('diagramSvgContainer').innerHTML = renderChordDiagramSVG(chord);
  const fretInfo = chord.barre ? ` · pestana na ${chord.baseFret}ª casa` : '';
  document.getElementById('diagramChordFullName').textContent = `${chord.displayName} — ${chord.voicingLabel}${fretInfo}`;
  document.getElementById('diagramArea').classList.remove('hidden');
}

Game.on('round', ({ chord, variability, startedAt }) => {
  clearAutoAdvanceTimer();
  document.getElementById('voicingLabel').textContent = chord.voicingLabel;
  document.getElementById('chordName').textContent = chord.displayName;
  const statusText = document.getElementById('statusText');
  statusText.textContent = 'Toque o acorde no violão...';
  statusText.className = 'hint-text';
  document.getElementById('diagramArea').classList.add('hidden');
  document.getElementById('revealBtn').disabled = false;
  document.getElementById('manualCorrectBtn').disabled = false;
  currentTargetPCs = chord.pitchClasses;
  updateScoreBar();
  updateModeProgress(variability);
  startLiveTimer(startedAt);
});

Game.on('correct', ({ chord, elapsedMs, session }) => {
  stopLiveTimer();
  const statusText = document.getElementById('statusText');
  statusText.textContent = `Isso aí — era ${chord.displayName} (${chord.voicingLabel})`;
  statusText.className = 'hint-text success-text';

  SessionStore.recordAttempt(true);

  if (elapsedMs != null && isTimingEnabled()) {
    const liveTimer = document.getElementById('liveTimer');
    liveTimer.textContent = formatSeconds(elapsedMs);
    liveTimer.className = 'live-timer live-timer-final';
    const prevBestMs = TimingStore.chordBestMs(chord.id);
    TimingStore.record(chord.id, elapsedMs);
    SessionStore.recordTimedHit(elapsedMs);
    checkAchievements({ chord, elapsedMs, prevBestMs, session });
  }

  const prompt = document.querySelector('.chord-prompt');
  prompt.classList.remove('celebrate');
  void prompt.offsetWidth; // reinicia a animação mesmo em acertos consecutivos
  prompt.classList.add('celebrate');
  showDiagram(chord);
  document.getElementById('revealBtn').disabled = true;
  document.getElementById('manualCorrectBtn').disabled = true;
  updateScoreBar();
  scheduleAutoAdvance();
});

Game.on('reveal', ({ chord }) => {
  stopLiveTimer();
  SessionStore.recordAttempt(false);
  const statusText = document.getElementById('statusText');
  statusText.textContent = `Essa é ${chord.displayName} (${chord.voicingLabel}). Tenta lembrar da próxima vez.`;
  statusText.className = 'hint-text reveal-text';
  if (isTimingEnabled()) {
    document.getElementById('liveTimer').className = 'live-timer live-timer-void';
    document.getElementById('liveTimer').textContent = '—';
  }
  showDiagram(chord);
  document.getElementById('revealBtn').disabled = true;
  document.getElementById('manualCorrectBtn').disabled = true;
  updateScoreBar();
});

// --- Conquistas (notificações no canto) --------------------------------------
const STREAK_MILESTONES = [5, 10, 15, 25, 50, 100];

function checkAchievements({ chord, elapsedMs, prevBestMs, session }) {
  // Recorde pessoal nesse acorde específico (só depois de já existir um tempo anterior).
  if (prevBestMs != null && elapsedMs < prevBestMs) {
    Toasts.push(`Novo recorde em ${chord.displayName}: ${formatSeconds(elapsedMs)}`, 'record');
  }

  // Marco de sequência de acertos.
  if (STREAK_MILESTONES.includes(session.streak)) {
    Toasts.push(`Sequência de ${session.streak} acertos seguidos`, 'streak');
  }

  // Acorde dominado pela primeira vez (≥85% de acerto, pelo menos 3 tentativas).
  const stat = StatsStore.get(chord.id);
  const rate = stat.seen ? stat.correct / stat.seen : 0;
  if (stat.seen >= 3 && rate >= 0.85 && !masteredSeen.has(chord.id)) {
    masteredSeen.add(chord.id);
    saveMasteredSet(masteredSeen);
    Toasts.push(`Você dominou ${chord.displayName}`, 'mastery');
  }

  maybeNotifySessionComparison();
}

// Compara a mediana da sessão atual com a da última sessão concluída — só uma vez
// por sessão, e só quando já há amostra suficiente pra não ser ruído.
function maybeNotifySessionComparison() {
  if (sessionComparisonShown) return;
  if (SessionStore.getCurrentCount() < 3) return;
  const last = SessionStore.getLastCompletedSession();
  if (!last || last.medianMs == null) return;
  const curMedian = SessionStore.getCurrentMedian();
  if (curMedian == null) return;

  sessionComparisonShown = true;
  const deltaPct = Math.round(((curMedian - last.medianMs) / last.medianMs) * 100);
  if (deltaPct <= -5) {
    Toasts.push(`${Math.abs(deltaPct)}% mais rápido que na última sessão`, 'speed');
  }
}

// --- Estatísticas -----------------------------------------------------------
function rateClassFor(rate) {
  return rate >= 80 ? 'rate-good' : rate >= 50 ? 'rate-mid' : 'rate-bad';
}

// Sparkline minimalista (ver skill dataviz: traço 2px, ponta com dedo de 2px na
// cor da superfície, uma só série então sem legenda — o rótulo do card já diz o quê é).
function renderSparklineSVG(values) {
  const width = 100;
  const height = 30;
  const pad = 5;
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y];
  });
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const [lastX, lastY] = points[points.length - 1];
  return `<svg viewBox="0 0 ${width} ${height}" class="sparkline-svg" preserveAspectRatio="none">
    <path d="${pathD}" class="sparkline-line" />
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="6" class="sparkline-end-ring" />
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" class="sparkline-end-dot" />
  </svg>`;
}

function renderTimingCard() {
  const times = TimingStore.getLog().map((e) => e.ms);
  if (times.length < 2) return '';

  const n = Math.min(8, Math.ceil(times.length / 2));
  const recentMedian = robustMedian(times.slice(-n));
  const earliestMedian = robustMedian(times.slice(0, n));

  let deltaHtml = '<span class="stats-delta">pratique mais pra ver a tendência</span>';
  if (times.length >= 4 && earliestMedian) {
    const deltaPct = Math.round(((recentMedian - earliestMedian) / earliestMedian) * 100);
    const improving = deltaPct < 0; // tempo menor = melhor
    const deltaClass = deltaPct === 0 ? '' : (improving ? 'rate-good' : 'rate-bad');
    const arrow = improving ? '↓' : deltaPct > 0 ? '↑' : '→';
    deltaHtml = `<span class="stats-delta ${deltaClass}">${arrow} ${Math.abs(deltaPct)}% vs. início</span>`;
  }

  // sparkline usa os valores sem outlier, pra o traço não ser esmagado por um pico isolado
  const sparkValues = withoutOutliers(times.slice(-24));

  return `<div class="stats-timing-card">
    <div class="stats-timing-info">
      <strong>${formatSeconds(recentMedian)}</strong>
      <span>tempo típico recente p/ formar o acorde</span>
      ${deltaHtml}
    </div>
    <div class="stats-timing-spark">${renderSparklineSVG(sparkValues)}</div>
  </div>`;
}

function renderStatsTable() {
  const container = document.getElementById('statsTable');
  const allRows = CHORD_LIBRARY.map((c) => ({ chord: c, stat: StatsStore.get(c.id) }));
  const practiced = allRows.filter((r) => r.stat.seen > 0);

  if (practiced.length === 0) {
    container.innerHTML = '<p class="hint-text">Você ainda não praticou nenhum acorde. Vá em "Praticar" para começar.</p>';
    return;
  }

  const totalAttempts = practiced.reduce((sum, r) => sum + r.stat.seen, 0);
  const totalCorrect = practiced.reduce((sum, r) => sum + r.stat.correct, 0);
  const overallRate = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const masteredCount = practiced.filter((r) => r.stat.seen >= 3 && r.stat.correct / r.stat.seen >= 0.85).length;

  let html = `
    <div class="stats-summary">
      <div class="stats-summary-card"><strong>${overallRate}%</strong><span>precisão geral</span></div>
      <div class="stats-summary-card"><strong>${totalAttempts}</strong><span>tentativas</span></div>
      <div class="stats-summary-card"><strong>${practiced.length}/${CHORD_LIBRARY.length}</strong><span>formas praticadas</span></div>
      <div class="stats-summary-card"><strong>${masteredCount}</strong><span>dominadas</span></div>
    </div>
    ${renderTimingCard()}`;

  const sections = [
    { type: 'open', title: 'Abertos' },
    { type: 'barreE', title: 'Pestana — base Mi' },
    { type: 'barreA', title: 'Pestana — base Lá' },
  ];

  sections.forEach((sec) => {
    const rows = practiced
      .filter((r) => r.chord.voicingType === sec.type)
      .sort((a, b) => (b.stat.wrong / b.stat.seen) - (a.stat.wrong / a.stat.seen));
    if (rows.length === 0) return;

    const sectionAttempts = rows.reduce((s, r) => s + r.stat.seen, 0);
    const sectionCorrect = rows.reduce((s, r) => s + r.stat.correct, 0);
    const sectionRate = sectionAttempts ? Math.round((sectionCorrect / sectionAttempts) * 100) : 0;

    html += `<div class="stats-section">
      <div class="stats-section-header">
        <h3>${sec.title}</h3>
        <span class="stats-section-rate">${rows.length} formas · ${sectionRate}%</span>
      </div>`;

    rows.forEach(({ chord, stat }) => {
      const rate = Math.round((stat.correct / stat.seen) * 100);
      const rc = rateClassFor(rate);
      const mastered = stat.seen >= 3 && rate >= 85;
      const typicalMs = TimingStore.chordTypicalMs(chord.id);
      html += `<div class="stats-row">
        <span class="stats-chord-name">${chord.displayName}${mastered ? '<span class="stats-badge" title="Dominado">dominado</span>' : ''}</span>
        <span class="stats-seen">${stat.seen}×</span>
        <div class="stats-bar-track"><div class="stats-bar-fill ${rc}" style="width:${rate}%"></div></div>
        <span class="stats-time">${typicalMs != null ? formatSeconds(typicalMs) : '—'}</span>
        <span class="stats-rate-label ${rc}">${rate}%</span>
      </div>`;
    });
    html += '</div>';
  });

  container.innerHTML = html;
}

// --- Inicialização -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadSelection();
  buildPresetGrid();
  buildChordPicker();
  refreshSelectionUI();
  buildChromaMeter();
  setMode(loadMode());

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('startTrainingBtn').addEventListener('click', () => {
    switchTab('play');
    attemptStartMic();
  });
  document.getElementById('enableMicBtn').addEventListener('click', attemptStartMic);

  document.getElementById('revealBtn').addEventListener('click', () => Game.handleReveal());
  document.getElementById('manualCorrectBtn').addEventListener('click', () => Game.handleManualCorrect());
  document.getElementById('nextBtn').addEventListener('click', () => {
    clearAutoAdvanceTimer();
    Game.nextRound();
  });

  const sensSlider = document.getElementById('sensitivitySlider');
  if (sensSlider) {
    sensSlider.value = PitchDetector.getSensitivity();
    sensSlider.addEventListener('input', (e) => PitchDetector.setSensitivity(parseFloat(e.target.value)));
  }

  const timingCheckbox = document.getElementById('timingEnabledCheckbox');
  if (timingCheckbox) {
    timingCheckbox.checked = loadTimingEnabled();
    timingCheckbox.addEventListener('change', () => {
      try { localStorage.setItem('chordTrainerTimingEnabled_v1', String(timingCheckbox.checked)); } catch (e) { /* ok */ }
      document.getElementById('liveTimer').classList.toggle('hidden', !timingCheckbox.checked);
    });
  }

  document.getElementById('resetStatsBtn').addEventListener('click', () => {
    if (confirm('Tem certeza que quer apagar todo o seu progresso salvo? Essa ação não pode ser desfeita.')) {
      StatsStore.resetAll();
      TimingStore.resetAll();
      SessionStore.resetAll();
      masteredSeen = new Set();
      saveMasteredSet(masteredSeen);
      renderStatsTable();
    }
  });
});
