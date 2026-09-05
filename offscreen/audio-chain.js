import { boostCurve, identityCurve } from "../shared/utils.js";

const RAMP_SECONDS = 0.015;
const MAX_DELAY_SECONDS = 0.5;

const VOICE_FREQUENCY = 2000;
const VOICE_Q = 0.9;
const VOICE_GAIN_DB = 6;

const NIGHT = Object.freeze({
  threshold: -30,
  knee: 24,
  ratio: 6,
  attack: 0.006,
  release: 0.18,
});

/**
 * source → downmix → stereoize → panner → [compressor] → voiceEq → gain → shaper → delay → destination
 *
 * `downmix` runs first because it has to see the stream's raw channel layout to
 * apply the correct downmix matrix. `compressor` sits ahead of `gain` so the
 * volume the user set is not fought by the compression, `voiceEq` after it so
 * the lift does not drive the compressor into pumping, `shaper` last of the
 * processing nodes so it still catches whatever EQ or boost pushes past full
 * scale, and `delay` at the very end because it only shifts the output in time.
 *
 * `stereoize` exists solely to guarantee the panner never sees a single
 * channel — see applyAudioSettings.
 *
 * Measured on Chromium: a peaking filter at 0 dB and a delay of 0 ms are both
 * bit-transparent, so they stay wired permanently. A DynamicsCompressorNode is
 * neither — even at ratio 1 it attenuates, and it costs a fixed 6 ms of
 * lookahead — so night mode is rewired rather than flattened.
 */
export function createAudioChain(context, source, audio, sink) {
  const downmix = context.createGain();
  downmix.channelCountMode = "explicit";
  downmix.channelInterpretation = "speakers";

  const stereoize = context.createGain();
  stereoize.channelCount = 2;
  stereoize.channelCountMode = "explicit";
  stereoize.channelInterpretation = "speakers";

  const panner = context.createStereoPanner();

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = NIGHT.threshold;
  compressor.knee.value = NIGHT.knee;
  compressor.ratio.value = NIGHT.ratio;
  compressor.attack.value = NIGHT.attack;
  compressor.release.value = NIGHT.release;

  const voiceEq = context.createBiquadFilter();
  voiceEq.type = "peaking";
  voiceEq.frequency.value = VOICE_FREQUENCY;
  voiceEq.Q.value = VOICE_Q;
  voiceEq.gain.value = 0;

  const gain = context.createGain();
  const shaper = context.createWaveShaper();
  const automation = context.createGain();
  const delay = context.createDelay(MAX_DELAY_SECONDS);

  source.connect(downmix);
  downmix.connect(stereoize);
  stereoize.connect(panner);
  voiceEq.connect(gain);
  gain.connect(shaper);
  shaper.connect(automation);
  automation.connect(delay);
  delay.connect(context.destination);

  const chain = {
    downmix,
    stereoize,
    panner,
    compressor,
    voiceEq,
    gain,
    shaper,
    automation,
    delay,
    volume: 1,
    voice: false,
    appliedShaper: null,
    appliedNight: null,
  };

  applyAudioSettings(chain, audio, context, { immediate: true });
  applySinkOptions(chain, sink, context, { immediate: true });
  return chain;
}

/** Route-level processing: identical on every output of the same tab. */
export function applyAudioSettings(chain, audio, context, { immediate = false } = {}) {
  // StereoPannerNode's channelCountMode is fixed at "clamped-max", so a single
  // input channel puts it on its equal-power branch, which costs 3 dB even at
  // pan 0. `stereoize` upmixes back to two channels — both for a mono source
  // and for the mono downmix below — so the panner always takes its
  // transparent stereo branch.
  chain.downmix.channelCount = audio.mono ? 1 : 2;

  setParam(chain.panner.pan, audio.balance, context, immediate);
  setParam(chain.voiceEq.gain, audio.voice ? VOICE_GAIN_DB : 0, context, immediate);

  chain.voice = audio.voice;
  updateShaper(chain);

  if (chain.appliedNight !== audio.night) {
    routeCompressor(chain, audio.night);
    chain.appliedNight = audio.night;
  }
}

/** Per-output level and timing. */
export function applySinkOptions(chain, sink, context, { immediate = false } = {}) {
  // Attenuation is exact in the gain node; boost lives in the shaper's curve.
  setParam(chain.gain.gain, sink.volume > 1 ? 1 : sink.volume, context, immediate);

  chain.volume = sink.volume;
  updateShaper(chain);

  setParam(chain.delay.delayTime, sink.delayMs / 1000, context, immediate);
}

/**
 * The identity curve is bit-transparent but clamps hard above full scale, so it
 * is only safe while nothing can push the signal there. The voice lift can do
 * that on its own at volume 1 — hence it engages the soft curve too.
 */
function updateShaper(chain) {
  const soft = chain.volume > 1 || chain.voice;
  const signature = soft ? chain.volume : 0;
  if (chain.appliedShaper === signature) return;

  chain.shaper.oversample = soft ? "2x" : "none";
  chain.shaper.curve = soft ? boostCurve(chain.volume) : identityCurve();
  chain.appliedShaper = signature;
}

export function disconnectAudioChain(chain) {
  if (!chain) return;

  for (const node of [
    chain.downmix,
    chain.stereoize,
    chain.panner,
    chain.compressor,
    chain.voiceEq,
    chain.gain,
    chain.shaper,
    chain.automation,
    chain.delay,
  ]) {
    node?.disconnect();
  }
}

/** Independent of manual volume, boost and processing; reaching the target is exact. */
export function applyAutomation(chain, value, context, seconds = 0.12) {
  const param = chain.automation.gain;
  if (chain.automationTarget === value) return;
  chain.automationTarget = value;
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(context.currentTime);
  } else {
    const current = param.value;
    param.cancelScheduledValues(context.currentTime);
    param.setValueAtTime(current, context.currentTime);
  }
  param.linearRampToValueAtTime(value, context.currentTime + seconds);
}

/**
 * Rewires rather than flattens: a compressor at ratio 1 still attenuates and
 * still costs its 6 ms of lookahead, so "off" has to mean "not in the graph".
 */
function routeCompressor(chain, night) {
  chain.panner.disconnect();
  chain.compressor.disconnect();

  if (night) {
    chain.panner.connect(chain.compressor);
    chain.compressor.connect(chain.voiceEq);
  } else {
    chain.panner.connect(chain.voiceEq);
  }
}

function setParam(param, value, context, immediate) {
  if (immediate) {
    param.value = value;
    return;
  }

  // Assigning .value on a live graph zippers; ramp instead.
  param.setTargetAtTime(value, context.currentTime, RAMP_SECONDS);
}
