// Gera os sons embutidos do app (WAV PCM 16-bit mono) por síntese simples.
// Uso: node scripts/generate-sounds.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 44100;
const OUT = join(process.cwd(), 'assets', 'sounds');

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Tom com envelope: attack curto e decaimento exponencial ou sustentado. */
function tone(freq, ms, { decay = 0, volume = 0.6, harmonics = [1], wave = 'sine' } = {}) {
  const n = Math.round((RATE * ms) / 1000);
  const out = new Float32Array(n);
  const attack = Math.min(n, Math.round(RATE * 0.005));
  const release = Math.min(n, Math.round(RATE * 0.02));
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    harmonics.forEach((amp, h) => {
      const phase = 2 * Math.PI * freq * (h + 1) * t;
      v += amp * (wave === 'square' ? Math.sign(Math.sin(phase)) * 0.5 : Math.sin(phase));
    });
    let env = 1;
    if (i < attack) env = i / attack;
    if (i > n - release) env *= (n - i) / release;
    if (decay > 0) env *= Math.exp(-decay * t);
    out[i] = v * env * volume;
  }
  return out;
}

const silence = (ms) => new Float32Array(Math.round((RATE * ms) / 1000));
const concat = (...parts) => Float32Array.from(parts.flatMap((p) => Array.from(p)));
const mix = (...parts) => {
  const len = Math.max(...parts.map((p) => p.length));
  const out = new Float32Array(len);
  parts.forEach((p) => p.forEach((v, i) => (out[i] += v)));
  return out;
};

/** Sino metálico: parciais inarmônicos (como um sino de ringue) com decaimento longo. */
function metalBell(freq, ms, { volume = 0.5, decay = 2.2 } = {}) {
  const partials = [
    [1, 1],
    [2.76, 0.6],
    [5.4, 0.35],
    [8.93, 0.2],
  ];
  const n = Math.round((RATE * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    partials.forEach(([ratio, amp], k) => {
      v += amp * Math.sin(2 * Math.PI * freq * ratio * t) * Math.exp(-decay * (1 + k * 0.8) * t);
    });
    const attack = Math.min(1, i / (RATE * 0.002));
    out[i] = v * attack * volume;
  }
  return out;
}

/** Batida seca (madeira): ruído filtrado bem curto + corpo grave. */
function knock(ms = 60) {
  const n = Math.round((RATE * ms) / 1000);
  const out = new Float32Array(n);
  let last = 0;
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    last = last * 0.6 + (random() * 2 - 1) * 0.4;
    const body = Math.sin(2 * Math.PI * 420 * t);
    out[i] = (last * 0.7 + body * 0.6) * Math.exp(-70 * t) * 0.9;
  }
  return out;
}

/** Varredura de frequência (sirene). */
function sweep(from, to, ms, volume = 0.4) {
  const n = Math.round((RATE * ms) / 1000);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = from + ((to - from) * i) / n;
    phase += (2 * Math.PI * f) / RATE;
    const edge = Math.min(1, i / (RATE * 0.01), (n - i) / (RATE * 0.01));
    out[i] = Math.sin(phase) * volume * edge;
  }
  return out;
}

const sounds = {
  'beep.wav': tone(880, 150),
  'beep_high.wav': tone(1320, 180),
  'double_beep.wav': concat(tone(988, 110), silence(70), tone(988, 110)),
  'whistle.wav': concat(tone(2200, 120, { volume: 0.4 }), tone(2600, 380, { volume: 0.4 })),
  'bell.wav': tone(660, 900, { decay: 4, harmonics: [1, 0.5, 0.25, 0.12] }),
  'gong.wav': tone(110, 1800, { decay: 1.8, harmonics: [1, 0.6, 0.4, 0.3, 0.2], volume: 0.7 }),
  'horn.wav': tone(330, 600, { harmonics: [1, 0.5, 0.33], wave: 'square', volume: 0.35 }),
  'go.wav': concat(tone(784, 120), silence(40), tone(1175, 320)),
  'rest.wav': mix(tone(523, 700, { decay: 3 }), tone(659, 700, { decay: 3, volume: 0.4 })),
  'finish.wav': concat(
    tone(523, 160),
    tone(659, 160),
    tone(784, 160),
    tone(1047, 600, { decay: 2, harmonics: [1, 0.3] }),
  ),
  // Ringue e luta
  'ring_bell.wav': metalBell(950, 1600),
  'ring_bell_3.wav': concat(
    metalBell(950, 330, { decay: 3 }),
    metalBell(950, 330, { decay: 3 }),
    metalBell(950, 1400),
  ),
  'clapper.wav': concat(knock(), silence(90), knock()),
  // Alertas
  'tick.wav': tone(2000, 30, { volume: 0.5 }),
  'start_321.wav': concat(
    tone(880, 150),
    silence(850),
    tone(880, 150),
    silence(850),
    tone(880, 150),
    silence(850),
    tone(1320, 500),
  ),
  'alarm.wav': concat(
    ...Array.from({ length: 3 }, () => [
      tone(880, 160, { volume: 0.5 }),
      tone(660, 160, { volume: 0.5 }),
    ]).flat(),
  ),
  'siren.wav': concat(sweep(600, 1300, 450), sweep(1300, 600, 450)),
  'buzzer.wav': tone(180, 800, { harmonics: [1, 0.6, 0.4, 0.3], wave: 'square', volume: 0.3 }),
  'chime.wav': concat(
    tone(1319, 160, { decay: 6, harmonics: [1, 0.3] }),
    tone(1976, 600, { decay: 4, harmonics: [1, 0.3] }),
  ),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(join(OUT, name), wav(samples));
  console.log(`gerado ${name} (${Math.round((samples.length / RATE) * 1000)} ms)`);
}
