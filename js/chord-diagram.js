/*
 * Gera o diagrama visual (SVG) de um "voicing" de acorde: cordas, trastes,
 * bolinhas com o dedo correto, barra de pestana e indicação de casa inicial.
 */

function renderChordDiagramSVG(voicing) {
  const numStrings = 6;
  const numFretSpaces = 4;
  const stringSpacing = 34;
  const fretSpacing = 48;
  const gridLeft = 46;
  const gridTop = 54;
  const width = gridLeft + (numStrings - 1) * stringSpacing + 36;
  const height = gridTop + numFretSpaces * fretSpacing + 46;

  const frets = voicing.frets;
  const fingers = voicing.fingers;
  const barre = voicing.barre;

  const numericFrets = frets.filter((f) => f !== 'x' && f > 0);
  const startFret = voicing.baseFret && voicing.baseFret > 0 ? voicing.baseFret : 1;
  const showNut = startFret === 1;

  const xForString = (i) => gridLeft + i * stringSpacing;
  const yForFretLine = (r) => gridTop + r * fretSpacing;
  const yForFretRow = (fretNum) => gridTop + (fretNum - startFret) * fretSpacing + fretSpacing / 2;

  let svg = '';
  svg += `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chord-diagram-svg">`;

  // Posição (quando não começa no traste 1)
  if (!showNut) {
    svg += `<text x="${gridLeft - 14}" y="${yForFretLine(0) + fretSpacing / 2 + 5}" class="diagram-position-label" text-anchor="end">${startFret}ª</text>`;
  }

  // Linhas de traste (horizontais)
  for (let r = 0; r <= numFretSpaces; r++) {
    const y = yForFretLine(r);
    const isNutLine = r === 0 && showNut;
    svg += `<line x1="${gridLeft}" y1="${y}" x2="${xForString(numStrings - 1)}" y2="${y}" class="${isNutLine ? 'diagram-nut' : 'diagram-fret-line'}" />`;
  }

  // Linhas de corda (verticais)
  for (let i = 0; i < numStrings; i++) {
    const x = xForString(i);
    svg += `<line x1="${x}" y1="${yForFretLine(0)}" x2="${x}" y2="${yForFretLine(numFretSpaces)}" class="diagram-string-line" />`;
  }

  // Barra de pestana (desenhada atrás das bolinhas individuais)
  if (barre) {
    const y = yForFretRow(barre.fret);
    const x1 = xForString(barre.fromIdx);
    const x2 = xForString(barre.toIdx);
    svg += `<rect x="${x1 - 13}" y="${y - 13}" width="${x2 - x1 + 26}" height="26" rx="13" class="diagram-barre" />`;
    svg += `<text x="${(x1 + x2) / 2}" y="${y + 5}" class="diagram-finger-label diagram-finger-label-on-barre" text-anchor="middle">1</text>`;
  }

  // Marcadores acima do diagrama: X (não tocar) / O (solta)
  frets.forEach((f, i) => {
    const x = xForString(i);
    const y = gridTop - 20;
    if (f === 'x') {
      svg += `<text x="${x}" y="${y + 6}" class="diagram-mute-label" text-anchor="middle">×</text>`;
    } else if (f === 0) {
      svg += `<circle cx="${x}" cy="${y}" r="7" class="diagram-open-marker" />`;
    }
  });

  // Bolinhas de dedos (fora da pestana)
  frets.forEach((f, i) => {
    if (f === 'x' || f === 0) return;
    const isBarreNote = barre && f === barre.fret && i >= barre.fromIdx && i <= barre.toIdx;
    if (isBarreNote) return;
    const x = xForString(i);
    const y = yForFretRow(f);
    svg += `<circle cx="${x}" cy="${y}" r="13" class="diagram-dot" />`;
    const fingerNum = fingers[i];
    if (fingerNum && fingerNum !== 'x' && fingerNum !== 0) {
      svg += `<text x="${x}" y="${y + 5}" class="diagram-finger-label" text-anchor="middle">${fingerNum}</text>`;
    }
  });

  // Nomes das cordas embaixo
  STRING_LABELS.forEach((label, i) => {
    const x = xForString(i);
    const y = yForFretLine(numFretSpaces) + 22;
    svg += `<text x="${x}" y="${y}" class="diagram-string-label" text-anchor="middle">${label}</text>`;
  });

  svg += '</svg>';
  return svg;
}
