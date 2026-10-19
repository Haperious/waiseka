// Soundtrack for the WaiseKa brag: 120 BPM, C major, 22s. Music + SFX written as one piece.
const fs = require('fs')
const SR = 48000, DUR = 22.0, N = Math.ceil(SR * DUR)
const BEAT = 0.5, BAR = 2
const L = new Float32Array(N), R = new Float32Array(N)       // dry bus
const SL = new Float32Array(N), SRb = new Float32Array(N)    // reverb send
const hz = m => 440 * Math.pow(2, (m - 69) / 12)
const NOTE = { C:0, 'C#':1, D:2, Eb:3, E:4, F:5, 'F#':6, G:7, Ab:8, A:9, Bb:10, B:11 }
const m = s => { const [, n, o] = s.match(/^([A-G][#b]?)(-?\d)$/); return NOTE[n] + 12 * (+o + 1) }
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1

function add(t0, buf, gain = 1, pan = 0, send = 0) {
  const i0 = Math.floor(t0 * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4)
  for (let i = 0; i < buf.length; i++) {
    const j = i0 + i; if (j < 0 || j >= N) continue
    L[j] += buf[i] * gl; R[j] += buf[i] * gr
    if (send) { SL[j] += buf[i] * gl * send; SRb[j] += buf[i] * gr * send }
  }
}
function lp(buf, cut) { const a = 1 - Math.exp(-2 * Math.PI * cut / SR); let y = 0; for (let i = 0; i < buf.length; i++) buf[i] = y += a * (buf[i] - y); return buf }
function hp(buf, cut) { const a = Math.exp(-2 * Math.PI * cut / SR); let x1 = 0, y = 0; for (let i = 0; i < buf.length; i++) { const x = buf[i]; y = a * (y + x - x1); x1 = x; buf[i] = y } return buf }

// ── instruments ──
function keys(f, len = 0.9) {            // soft electric-piano pluck
  const n = Math.floor(len * SR), b = new Float32Array(n)
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t / 0.004) * Math.exp(-t * 4.2)
    b[i] = e * (Math.sin(2 * Math.PI * f * t) + 0.28 * Math.exp(-t * 9) * Math.sin(2 * Math.PI * f * 2 * t) + 0.08 * Math.exp(-t * 14) * Math.sin(2 * Math.PI * f * 3 * t)) }
  return b
}
function bell(f, len = 1.6) {             // chime for UI moments, harmonic so it sits in key
  const n = Math.floor(len * SR), b = new Float32Array(n)
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t / 0.002)
    b[i] = e * (Math.exp(-t * 3) * Math.sin(2 * Math.PI * f * t) + 0.35 * Math.exp(-t * 6) * Math.sin(2 * Math.PI * f * 2 * t) + 0.12 * Math.exp(-t * 10) * Math.sin(2 * Math.PI * f * 3.01 * t)) }
  return b
}
function pad(freqs, len, cut = 1400) {   // warm detuned pad with slow swell
  const n = Math.floor(len * SR), b = new Float32Array(n)
  for (const f of freqs) for (const d of [-0.006, 0.006]) { const ff = f * (1 + d); let ph = Math.random()
    for (let i = 0; i < n; i++) { ph += ff / SR; const x = ph % 1; b[i] += (2 * x - 1) * 0.12 } }
  lp(lp(b, cut), cut)
  for (let i = 0; i < n; i++) { const t = i / SR; b[i] *= Math.min(1, t / 0.35) * Math.min(1, (len - t) / 0.4) }
  return b
}
function bass(f, len) {
  const n = Math.floor(len * SR), b = new Float32Array(n)
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t / 0.006) * Math.min(1, (len - t) / 0.03) * (0.75 + 0.25 * Math.exp(-t * 8))
    b[i] = e * Math.tanh(1.6 * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t))) }
  return b
}
function kick() { const n = Math.floor(0.4 * SR), b = new Float32Array(n); let ph = 0
  for (let i = 0; i < n; i++) { const t = i / SR, f = 48 + 90 * Math.exp(-t * 30); ph += f / SR; b[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) } return b }
function clap() { const n = Math.floor(0.25 * SR), b = new Float32Array(n)
  for (let i = 0; i < n; i++) { const t = i / SR; b[i] = rnd() * (Math.exp(-t * 22) + 0.3 * Math.exp(-((t - 0.012) ** 2) * 4e5)) }
  return lp(hp(b, 900), 5000) }
function hat(len = 0.06) { const n = Math.floor(len * SR), b = new Float32Array(n)
  for (let i = 0; i < n; i++) b[i] = rnd() * Math.exp(-i / SR * 60); return lp(hp(b, 7000), 12000) }
function whoosh(len = 0.5, up = true) { const n = Math.floor(len * SR), b = new Float32Array(n); let y = 0
  for (let i = 0; i < n; i++) { const t = i / SR, k = t / len, env = up ? Math.sin(Math.PI * Math.pow(k, 1.6)) : Math.sin(Math.PI * k)
    const a = 1 - Math.exp(-2 * Math.PI * (300 + 2500 * Math.sin(Math.PI * k)) / SR); y += a * (rnd() - y); b[i] = y * env } return hp(b, 200) }
function riser(len) { const n = Math.floor(len * SR), b = new Float32Array(n); let y = 0, ph = 0
  for (let i = 0; i < n; i++) { const t = i / SR, k = t / len, a = 1 - Math.exp(-2 * Math.PI * (200 + 5000 * k * k) / SR); y += a * (rnd() - y)
    ph += (hz(m('G4')) * (1 + k)) / SR; b[i] = (y * 0.8 + 0.12 * Math.sin(2 * Math.PI * ph)) * k * k } return hp(b, 150) }
function boom() { const n = Math.floor(1.4 * SR), b = new Float32Array(n); let ph = 0
  for (let i = 0; i < n; i++) { const t = i / SR, f = 38 + 60 * Math.exp(-t * 12); ph += f / SR; b[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.6) } return b }

// ── harmony: one chord per 2s bar ──
const CH = {
  Fmaj7: ['F3','A3','C4','E4'], G6: ['G3','B3','D4','E4'], Am: ['A3','C4','E4','G4'],
  C: ['C4','E4','G4','B4'], G: ['G3','B3','D4','A4'], F: ['F3','A3','C4','E4'], Cend: ['C4','E4','G4','D5'],
}
const ROOT = { Fmaj7:'F2', G6:'G2', Am:'A2', C:'C2', G:'G2', F:'F2', Cend:'C2' }
const BARS = ['Fmaj7','G6','Am','C','G','Am','F','C','G','F','Cend']  // 11 bars = 22s; drop at bar 3 (6.0s)

BARS.forEach((c, bi) => {
  const t0 = bi * BAR, last = bi === BARS.length - 1, full = bi >= 3
  // pad
  add(t0, pad(CH[c].map(n => hz(m(n))), last ? 2.6 : BAR + 0.15, full ? 1500 : 900), full ? 0.20 : 0.16, 0, 0.5)
  // keys arpeggio (8ths); sparse in intro
  const pattern = full ? [0,2,1,3,2,1,3,2] : [0,null,2,null,1,null,3,null]
  pattern.forEach((idx, k) => {
    if (idx === null || (last && k > 0)) return
    const note = m(CH[c][idx]) + 12
    add(t0 + k * BEAT / 2, keys(hz(note), last ? 2.4 : 0.8), full ? 0.15 : 0.17, k % 2 ? 0.3 : -0.3, 0.45)
  })
  if (full) {
    // bass: root on 8ths with rest on the "and" of 4
    const r = hz(m(ROOT[c]))
    if (last) add(t0, bass(r, 2.2), 0.32)
    else for (let k = 0; k < 8; k++) if (k !== 7) add(t0 + k * BEAT / 2, bass(k === 6 ? r * 1.5 : r, 0.22), 0.27)
    if (!last) {
      for (const b of [0, 2]) add(t0 + b * BEAT, kick(), 0.55)
      for (const b of [1, 3]) add(t0 + b * BEAT, clap(), 0.11, 0.1, 0.35)
      for (let k = 0; k < 8; k++) add(t0 + k * BEAT / 2, hat(k % 2 ? 0.05 : 0.03), k % 2 ? 0.05 : 0.03, 0.35)
    } else add(t0, kick(), 0.5)
  } else if (bi >= 1) {
    for (let k = 0; k < 8; k++) add(t0 + k * BEAT / 2, hat(0.03), 0.025, 0.35)   // light hats build tension
  }
})

// ── SFX, in key and in the same room ──
// 1 · sweldo notification lands
add(0.55, bell(hz(m('G5'))), 0.11, 0.1, 0.6); add(0.62, bell(hz(m('C6'))), 0.09, 0.15, 0.6); add(0.69, bell(hz(m('E6'))), 0.08, 0.2, 0.6)
add(0.18, whoosh(0.4), 0.05)
// 2 · expense chips: descending A-minor pentatonic plucks, one per chip
;[3.15,3.40,3.65,3.85,4.02,4.18,4.32].forEach((t, i) => add(t + 0.04, keys(hz(m(['E5','D5','C5','A4','G4','E4','D4'][i])), 0.5), 0.07, i % 2 ? 0.45 : -0.45, 0.4))
add(4.45, boom(), 0.16)                    // balance hits bottom
add(4.6, riser(1.4), 0.07, 0, 0.3)          // build into drop
// 3 · the drop
add(6.0, boom(), 0.24); add(6.0, bell(hz(m('C6')), 2.2), 0.08, 0, 0.7)
// scene whooshes
for (const t of [8.75, 12.75, 15.75, 18.75]) add(t, whoosh(0.5), 0.045, 0, 0.3)
// 4 · timeline rows (G chord tones), footer count, warning flag
;['G5','B5','D6','G6'].forEach((n, i) => add(9.55 + i * 0.22, bell(hz(m(n)), 0.8), 0.04, 0.3, 0.5))
add(10.45, keys(hz(m('E5')), 0.6), 0.06, 0, 0.4); add(10.9, keys(hz(m('C5')), 0.6), 0.05, 0, 0.4)
// 5 · voice: mic on, heard, save, toast
add(13.4, bell(hz(m('C6')), 0.5), 0.05, -0.2, 0.4); add(13.48, bell(hz(m('G6')), 0.5), 0.045, -0.2, 0.4)
add(14.6, bell(hz(m('G6')), 0.5), 0.045, 0.2, 0.4); add(14.68, bell(hz(m('C7')), 0.5), 0.04, 0.2, 0.4)
add(15.18, hat(0.02), 0.05)
;['C6','E6','G6'].forEach((n, i) => add(15.3 + i * 0.06, bell(hz(m(n)), 1.2), 0.05, 0.25, 0.6))
// 6 · score ring sweep
add(16.2, riser(1.3), 0.035, 0, 0.4); add(17.5, bell(hz(m('B5')), 1.4), 0.07, 0, 0.6)
add(16.95, keys(hz(m('D5')), 0.5), 0.04, -0.3, 0.4)
// 7 · outro CTA
;['C5','G5','C6','E6'].forEach((n, i) => add(19.9 + i * 0.07, bell(hz(m(n)), 2.2), 0.06, (i - 1.5) * 0.15, 0.7))

// ── reverb (Schroeder) on the send bus ──
function reverb(x, off) {
  const out = new Float32Array(N)
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => Math.round((d + off) * SR / 44100))
  for (const d of combs) { const buf = new Float32Array(d); let k = 0, f = 0
    for (let i = 0; i < N; i++) { const y = buf[k]; f = y * 0.6 + f * 0.4; buf[k] = x[i] + f * 0.82; out[i] += y; k = (k + 1) % d } }
  for (const d of [556, 441, 341].map(d => Math.round((d + off) * SR / 44100))) { const buf = new Float32Array(d); let k = 0
    for (let i = 0; i < N; i++) { const b = buf[k], y = -out[i] + b; buf[k] = out[i] + b * 0.5; out[i] = y; k = (k + 1) % d } }
  return hp(out, 250)
}
const RL = reverb(SL, 0), RR = reverb(SRb, 23)

// ── master: sum, gentle glue, fade tail, normalize ──
const outL = new Float32Array(N), outR = new Float32Array(N); let peak = 0
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.02) * (t > DUR - 1.0 ? Math.max(0, (DUR - t) / 1.0) : 1)
  outL[i] = Math.tanh((L[i] + RL[i] * 0.16) * 1.1) * fade
  outR[i] = Math.tanh((R[i] + RR[i] * 0.16) * 1.1) * fade
  peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]))
}
const g = 0.89 / peak
const wav = Buffer.alloc(44 + N * 4)
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVE', 8); wav.write('fmt ', 12)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(SR, 24)
wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) { wav.writeInt16LE(Math.round(outL[i] * g * 32767), 44 + i * 4); wav.writeInt16LE(Math.round(outR[i] * g * 32767), 46 + i * 4) }
fs.writeFileSync(__dirname + '/audio.wav', wav)
console.log('peak', peak.toFixed(3), 'gain', g.toFixed(3))
