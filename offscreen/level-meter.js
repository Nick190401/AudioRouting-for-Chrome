import { channelLevels } from "../shared/focus.js";

/** Audio stays in the graph. Only scalar peak/RMS values leave the processor. */
class AudioRouteLevelMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.enabled = false;
    this.frames = 0;
    this.peak = 0;
    this.energy = 0;
    this.port.onmessage = ({ data }) => {
      this.enabled = data?.enabled === true;
      this.frames = 0;
      this.peak = 0;
      this.energy = 0;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0] ?? [];
    const output = outputs[0] ?? [];
    for (let channel = 0; channel < output.length; channel += 1) {
      if (input[channel]) output[channel].set(input[channel]);
      else output[channel].fill(0);
    }
    if (!this.enabled) return true;
    const frames = output[0]?.length ?? input[0]?.length ?? 128;
    const level = channelLevels(input);
    this.peak = Math.max(this.peak, level.peak);
    this.energy += level.rms * level.rms * frames;
    this.frames += frames;
    if (this.frames >= sampleRate / 20) {
      this.port.postMessage({ peak: this.peak, rms: Math.sqrt(this.energy / this.frames) });
      this.frames = 0;
      this.peak = 0;
      this.energy = 0;
    }
    return true;
  }
}

registerProcessor("audioroute-level-meter", AudioRouteLevelMeter);
