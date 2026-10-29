const uploadInput = document.getElementById('ecgUpload');
const analyzeBtn = document.getElementById('analyzeBtn');
const uploadedImage = document.getElementById('uploadedImage');
const emptyState = document.getElementById('emptyState');
const summaryTitle = document.getElementById('summaryTitle');
const riskPill = document.getElementById('riskPill');
const heartRateEl = document.getElementById('heartRate');
const qrsValueEl = document.getElementById('qrsValue');
const prValueEl = document.getElementById('prValue');
const qtValueEl = document.getElementById('qtValue');
const findingsList = document.getElementById('findingsList');
const clinicalNote = document.getElementById('clinicalNote');
const waveCanvas = document.getElementById('waveCanvas');
const ctx = waveCanvas.getContext('2d');

let latestImage = null;

function setRiskStyle(value) {
  const map = {
    normal: { bg: 'rgba(89, 214, 150, 0.18)', color: '#8ef0b5', border: 'rgba(89, 214, 150, 0.45)' },
    caution: { bg: 'rgba(247, 199, 93, 0.18)', color: '#ffd77c', border: 'rgba(247, 199, 93, 0.4)' },
    danger: { bg: 'rgba(255, 113, 103, 0.18)', color: '#ffb1a8', border: 'rgba(255, 113, 103, 0.45)' },
    critical: { bg: 'rgba(220, 66, 100, 0.2)', color: '#ff9eb0', border: 'rgba(220, 66, 100, 0.52)' },
    unknown: { bg: 'rgba(255,255,255,0.04)', color: '#d6edf8', border: 'rgba(255,255,255,0.08)' }
  };

  const style = map[value] || map.unknown;
  riskPill.style.background = style.bg;
  riskPill.style.color = style.color;
  riskPill.style.border = `1px solid ${style.border}`;
}

function renderWaveform(signal, bpm, label) {
  const canvas = waveCanvas;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#071521';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const y = (height / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#5fe5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const minVal = Math.min(...signal);
  const maxVal = Math.max(...signal);
  const range = Math.max(1, maxVal - minVal);

  signal.forEach((value, index) => {
    const x = (index / (signal.length - 1)) * width;
    const normalized = (value - minVal) / range;
    const y = height - normalized * (height - 30) - 15;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  ctx.fillStyle = 'rgba(95, 229, 255, 0.8)';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${label} • ${Math.round(bpm)} bpm`, 16, 18);
}

function normalizeSignal(arr) {
  const values = arr.slice();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map(v => (v - min) / range);
}

function smoothArray(values, radius = 3) {
  const result = [];
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
      sum += values[j];
      count++;
    }
    result.push(sum / count);
  }
  return result;
}

function detectPeaks(signal) {
  const peaks = [];
  for (let i = 1; i < signal.length - 1; i++) {
    const prev = signal[i - 1];
    const curr = signal[i];
    const next = signal[i + 1];
    if (curr > prev && curr > next && curr > 0.4) {
      peaks.push(i);
    }
  }
  return peaks;
}

function computeImageMetrics(image) {
  const canvas = document.createElement('canvas');
  const maxWidth = 1200;
  canvas.width = Math.min(maxWidth, image.naturalWidth || image.width);
  canvas.height = Math.min(700, image.naturalHeight || image.height);

  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  const samples = [];
  const step = Math.max(1, Math.floor(canvas.width / 1000));

  for (let x = 0; x < canvas.width; x += step) {
    let total = 0;
    let count = 0;
    for (let y = 0; y < canvas.height; y++) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const contrast = 255 - lum;
      if (contrast > 30) {
        total += contrast;
        count++;
      }
    }
    samples.push(count ? total / count : 0);
  }

  const smoothed = smoothArray(samples, 4);
  const normalized = normalizeSignal(smoothed);
  const peaks = detectPeaks(normalized);

  let bpm = 72;
  if (peaks.length >= 2) {
    const distances = [];
    for (let i = 1; i < peaks.length; i++) {
      const delta = (peaks[i] - peaks[i - 1]) * step;
      if (delta > 0) distances.push(delta);
    }
    if (distances.length > 0) {
      const avgMs = distances.reduce((a, b) => a + b, 0) / distances.length;
      bpm = 60000 / avgMs;
    }
  }

  const variance = peaks.length > 3
    ? Math.abs(peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1)
    : 0;

  const lowerBand = Math.floor(canvas.height * 0.68);
  const upperBand = Math.floor(canvas.height * 0.1);
  let lowerIntensity = 0;
  let upperIntensity = 0;
  let midIntensity = 0;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const contrast = 255 - lum;
      if (y > lowerBand) lowerIntensity += contrast;
      else if (y < upperBand) upperIntensity += contrast;
      else midIntensity += contrast;
    }
  }

  return {
    bpm,
    variance,
    normalized,
    lowerIntensity,
    upperIntensity,
    midIntensity,
    canvas,
    width: canvas.width,
    height: canvas.height
  };
}

function classifyRhythm(metrics) {
  const { bpm, variance, normalized, lowerIntensity, upperIntensity, midIntensity } = metrics;

  const isIrregular = variance > 0.18;
  const highLowerSignal = lowerIntensity > (midIntensity * 1.25);
  const highUpperSignal = upperIntensity > (midIntensity * 1.3);
  const broadWave = normalized.some(v => v > 0.8);

  let label = 'Normal Sinüs Ritmi';
  let risk = 'normal';
  let findings = [
    'Ritim düzenli görünüyor; normal sinüs ritmi olasılığı yüksek.'
  ];

  if (bpm < 50) {
    label = 'Bradikardi';
    risk = 'danger';
    findings = [
      'Kalp hızı düşük saptandı; bradikardi/konduksiyon bozukluğu olasılığı değerlendirilmelidir.',
      'Bu görünüm, sinüs nodu disfonksiyonu veya AV blok için dikkatle yorumlanmalıdır.'
    ];
  } else if (bpm > 100) {
    label = 'Taşikardi';
    risk = 'caution';
    findings = [
      'Kalp hızı yüksek; taşikardi / stres yanıtı veya aritmi olasılığı düşünülebilir.',
      'Ritim ve ST-T değişiklikleri ek olarak değerlendirilmelidir.'
    ];
  } else if (isIrregular) {
    label = 'Atrial Fibrilasyon / Düzensiz Ritm';
    risk = 'critical';
    findings = [
      'Ritim düzeni bozulmuş; atrial fibrilasyon veya önemli aritmi olasılığı yükseliyor.',
      'Irregular RR aralıkları ve düzensiz kompleksler açısından ayrıntılı değerlendirme gerekir.'
    ];
  }

  if (broadWave && bpm > 100) {
    label = 'Ventriküler Taşikardi / Geniş QRS Patolojisi';
    risk = 'critical';
    findings = [
      'Geniş ve taşkın dalga yapısı, ventriküler ritim problemini düşündürebilir.',
      'Acil kardiyak değerlendirme ve elektrokardiyografik doğrulama önerilir.'
    ];
  }

  if (highLowerSignal && !isIrregular) {
    label = 'Inferior MI / Inferior STEMI Olasılığı';
    risk = 'critical';
    findings = [
      'Alt kesim (inferior) dalga görünümünde ST elevasyon / işaret değişimi eğilimi mevcut olabilir.',
      'Inferior MI, özellikle II, III ve aVF yönlerinde ST yükselmesi için detaylı ECG gerekir.'
    ];
  }

  if (highUpperSignal && bpm <= 100) {
    label = 'NSTEMI / Anterior İskemik Değişim Olasılığı';
    risk = 'danger';
    findings = [
      'Üst bölgede ST depresyon / T invertasyonu benzeri verilere yaklaşan desen gözlenebilir.',
      'NSTEMI veya iskemik değişim için ST-T analizi ve klinik bağlam şarttır.'
    ];
  }

  if (bpm >= 120 && highLowerSignal) {
    label = 'Acil Iskemi / Inferior MI Taşikardisi';
    risk = 'critical';
    findings = [
      'Yüksek hız ve inferior iskemik görünüm birlikte değerlendirildiğinde akut iskemi için yüksek şüphe vardır.',
      'Habis aritmi ve MI dışlaması için acil klinik değerlendirme gerekir.'
    ];
  }

  if (bpm < 60 && highLowerSignal) {
    label = 'Bradikardi + Inferior Iskemi Şüphesi';
    risk = 'danger';
    findings = [
      'Düşük kalp hızı ile inferior yönlü eğilim birlikte görülüyor.',
      'AV blok, sinüs nodu disfonksiyonu veya inferior iskemi için ek değerlendirme gerekir.'
    ];
  }

  if (bpm > 120 && isIrregular) {
    label = 'Atrial Fibrilasyon + Hızlı Ventriküler Yanıt';
    risk = 'critical';
    findings = [
      'Aritmik ritim ve yüksek ventriküler yanıt bir arada görülüyor.',
      'Acil hemodinamik değerlendirme ve kardiyoloji konsültasyonu önerilir.'
    ];
  }

  findings.push('Bu sonuç görüntü tabanlı ön değerlendirme amaçlıdır; kesin tanı için profesyonel ECG ve klinik muayene gerekir.');

  return { label, risk, findings };
}

function updateUI(result, bpm) {
  summaryTitle.textContent = result.label;
  riskPill.textContent = result.risk === 'normal' ? 'NORMAL' : result.risk === 'caution' ? 'DİKKAT' : result.risk === 'danger' ? 'YÜKSEK RİSK' : 'KRİTİK';
  setRiskStyle(result.risk);

  heartRateEl.textContent = `${Math.round(bpm)} bpm`;
  qrsValueEl.textContent = `${Math.max(70, Math.min(160, Math.round(90 + bpm / 5)))} ms`;
  prValueEl.textContent = `${Math.max(110, Math.min(220, Math.round(160 + bpm / 10)))} ms`;
  qtValueEl.textContent = `${Math.max(300, Math.min(500, Math.round(350 + bpm / 4)))} ms`;

  findingsList.innerHTML = '';
  result.findings.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    findingsList.appendChild(li);
  });

  if (result.risk === 'normal') {
    clinicalNote.textContent = 'Görüntü, normal sinüs ritmi ile uyumlu görünmektedir. Ancak kesin teşhis için ECG ve klinik değerlendirme gereklidir.';
  } else if (result.risk === 'caution') {
    clinicalNote.textContent = 'Ritim değişikliği veya iskemik görünüm eğilimi saptanmıştır. Tekrarlayan ECG ve klinik takip önerilir.';
  } else if (result.risk === 'danger') {
    clinicalNote.textContent = 'Önemli ritim/iskemik şüphe saptanmıştır. Bu sonuç klinik tanı için uyarı niteliğindedir; hekim değerlendirmesi gerekir.';
  } else {
    clinicalNote.textContent = 'Ağır aritmi veya akut iskemik görünüm açısından yüksek şüphe vardır. Acil klinik yönlendirme ve doğrulayıcı ECG gereklidir.';
  }
}

function analyzeImage(image) {
  const metrics = computeImageMetrics(image);
  const classification = classifyRhythm(metrics);
  updateUI(classification, metrics.bpm);
  renderWaveform(metrics.normalized, metrics.bpm, classification.label);
}

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      latestImage = img;
      uploadedImage.src = reader.result;
      uploadedImage.hidden = false;
      emptyState.hidden = true;
      analyzeImage(img);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

uploadInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  handleFile(file);
});

analyzeBtn.addEventListener('click', () => {
  if (latestImage) {
    analyzeImage(latestImage);
  }
});

setRiskStyle('unknown');
summaryTitle.textContent = 'Analiz bekleniyor';
