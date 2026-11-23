// Tiny chiptune bed for the Starfall video — synthesized here, no samples.
// A bright square-wave arpeggio over a soft sine bass, 132 BPM, C major.
// Writes a 16-bit mono WAV to stdout (pipe it into ffmpeg, don't save it).
//
// Usage:
//   node render-audio.mjs --seconds 41 | ffmpeg -f wav -i - -c:a aac audio.m4a
const SR = 44100;
const args = process.argv.slice(2);
const seconds = parseFloat(args[args.indexOf("--seconds") + 1] || "41");

const BPM = 132;
const BEAT = 60 / BPM;          // one quarter note
const EIGHTH = BEAT / 2;

// lead: C major pentatonic arpeggio, two bars looping (16 eighth notes)
const LEAD = [523.25, 659.25, 783.99, 880.0, 783.99, 659.25, 523.25, 659.25,
              587.33, 659.25, 783.99, 1046.5, 880.0, 783.99, 659.25, 587.33];
// bass roots, one per bar: C, F, G, F
const BASS = [130.81, 174.61, 196.0, 174.61];

const total = Math.floor(seconds * SR);
const pcm = new Int16Array(total);

function noteAt(freq, t, dur, vol, wave) {
  // returns the sample value of a note with a short attack + exp decay
  const ph = t * freq * 2 * Math.PI;
  let v;
  if (wave === "square") v = Math.sign(Math.sin(ph)) * 0.6 + Math.sin(ph) * 0.4;
  else v = Math.sin(ph);
  const attack = Math.min(1, t / 0.01);
  const decay = Math.exp(-t * (wave === "square" ? 2.2 : 1.4));
  return v * vol * attack * decay;
}

for (let i = 0; i < total; i++) {
  const t = i / SR;
  let s = 0;
  // lead: eighth-note steps
  const step = Math.floor(t / EIGHTH);
  const stepT = t - step * EIGHTH;
  const leadFreq = LEAD[step % LEAD.length];
  s += noteAt(leadFreq, stepT, EIGHTH, 0.16, "square");
  // bass: one root per bar (8 eighth notes)
  const bar = Math.floor(t / (EIGHTH * 8));
  const barT = t - bar * EIGHTH * 8;
  s += noteAt(BASS[bar % BASS.length], barT, EIGHTH * 8, 0.22, "sine");
  // soft sparkle: a quiet high octave on the off-beats
  if (step % 2 === 1) {
    s += noteAt(leadFreq * 2, stepT, EIGHTH, 0.05, "sine");
  }
  // gentle fade in/out so the bed never clicks
  const fadeIn = Math.min(1, t / 0.5);
  const fadeOut = Math.min(1, (seconds - t) / 1.5);
  s *= fadeIn * fadeOut;
  pcm[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
}

// minimal WAV header (PCM16 mono 44.1k)
const dataBytes = pcm.length * 2;
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + dataBytes, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);      // PCM
header.writeUInt16LE(1, 22);      // mono
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2, 28); // byte rate
header.writeUInt16LE(2, 32);      // block align
header.writeUInt16LE(16, 34);     // bits
header.write("data", 36);
header.writeUInt32LE(dataBytes, 40);

process.stdout.write(header);
process.stdout.write(Buffer.from(pcm.buffer));
process.stderr.write(`audio: ${seconds}s chiptune bed rendered\n`);
