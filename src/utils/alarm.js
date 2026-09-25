// Web Audio synthesizer for Pyrewatch operational alarms.
// 100% browser-synthesized with zero audio file dependencies.
// Only fires on High or Critical priority changes, respects mute state,
// and respects prefers-reduced-motion accessibility settings.

let audioContext = null;
let masterGain = null;

export function unlockAlarmAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    audioContext ||= new AudioCtx();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    if (!masterGain) {
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.15; // Safe, audible, polite volume
      masterGain.connect(audioContext.destination);
    }
    return true;
  } catch {
    return false;
  }
}

export function playAlarm(tier = "High", muted = false) {
  if (muted || (tier !== "High" && tier !== "Critical")) return;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  try {
    unlockAlarmAudio();
    if (!audioContext || !masterGain) return;

    const now = audioContext.currentTime;

    if (tier === "Critical") {
      // Critical alert: 3 distinct urgent pulses
      const pulses = [0, 0.16, 0.32];
      pulses.forEach((offset) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now + offset); // A5
        osc.frequency.exponentialRampToValueAtTime(587.33, now + offset + 0.12); // D5

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.18, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.14);
      });
    } else {
      // High alert: Dual-tone ascending chime (587Hz -> 880Hz)
      const notes = [
        { freq: 587.33, time: 0, dur: 0.18 }, // D5
        { freq: 880, time: 0.14, dur: 0.26 },   // A5
      ];
      notes.forEach(({ freq, time, dur }) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.linearRampToValueAtTime(0.16, now + time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + time);
        osc.stop(now + time + dur + 0.02);
      });
    }
  } catch (err) {
    console.warn("Alarm synthesis notice:", err);
  }
}
