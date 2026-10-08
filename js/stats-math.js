/*
 * Funções estatísticas compartilhadas: mediana e remoção de outliers.
 * Usadas por toda métrica de tempo do app, pra uma rodada isolada muito lenta
 * (distração, pausa, falso positivo do microfone) não distorcer a estatística.
 */

function percentileOf(sortedValues, p) {
  const idx = p * (sortedValues.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

function medianOf(values) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Remove outliers pelo método do intervalo interquartil (IQR) — o mesmo critério
// usado em boxplots. Com menos de 4 valores a amostra é pequena demais pra
// detectar outlier com confiança, então devolve tudo sem filtrar.
function withoutOutliers(values) {
  if (values.length < 4) return values.slice();
  const sorted = values.slice().sort((a, b) => a - b);
  const q1 = percentileOf(sorted, 0.25);
  const q3 = percentileOf(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return values.slice();
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = values.filter((v) => v >= lower && v <= upper);
  return filtered.length ? filtered : values.slice(); // nunca devolve vazio
}

// A métrica "oficial" de tempo típico do app: mediana depois de tirar outliers.
function robustMedian(values) {
  return medianOf(withoutOutliers(values));
}
