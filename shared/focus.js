export const FOCUS_DEFAULTS = Object.freeze({
  activationDb: -45,
  releaseDb: -51,
  holdMs: 600,
  duckGain: 0.2,
  attackSeconds: 0.12,
  releaseSeconds: 0.45,
});

/** Max per-channel RMS avoids cancellation between opposite-phase channels. */
export function channelLevels(channels) {
  let peak = 0;
  let rms = 0;
  for (const channel of channels) {
    let energy = 0;
    for (const sample of channel) {
      const value = Number.isFinite(sample) ? sample : 0;
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
    }
    if (channel.length) rms = Math.max(rms, Math.sqrt(energy / channel.length));
  }
  return { peak, rms };
}

export function createActivityState() {
  return { active: false, lastAboveRelease: null };
}

export function updateActivity(state, rms, nowMs) {
  const db = rms > 0 && Number.isFinite(rms) ? 20 * Math.log10(rms) : -Infinity;
  if (db >= (state.active ? FOCUS_DEFAULTS.releaseDb : FOCUS_DEFAULTS.activationDb)) {
    state.active = true;
    state.lastAboveRelease = nowMs;
  } else if (state.active && nowMs - state.lastAboveRelease >= FOCUS_DEFAULTS.holdMs) {
    state.active = false;
  }
  return state.active;
}

export function mixAttenuation({ tabId, muted, soloTabId, focus }) {
  const effectiveMuted = muted || (soloTabId !== null && soloTabId !== tabId);
  const ducked = !effectiveMuted && focus.enabled && focus.active && focus.priorityTabId !== tabId;
  return { effectiveMuted, ducked, gain: effectiveMuted ? 0 : ducked ? FOCUS_DEFAULTS.duckGain : 1 };
}
