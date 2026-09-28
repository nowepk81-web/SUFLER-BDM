class CaptureChunks extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = Math.round(sampleRate * 3.6);
    this.samples = new Float32Array(this.size);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      let position = 0;
      while (position < channel.length) {
        const count = Math.min(this.size - this.offset, channel.length - position);
        this.samples.set(channel.subarray(position, position + count), this.offset);
        this.offset += count;
        position += count;
        if (this.offset === this.size) {
          const complete = this.samples;
          this.port.postMessage(complete, [complete.buffer]);
          this.samples = new Float32Array(this.size);
          this.offset = 0;
        }
      }
    }
    outputs[0]?.[0]?.fill(0); // Required connection, but never play microphone audio.
    return true;
  }
}

registerProcessor('capture-chunks', CaptureChunks);
