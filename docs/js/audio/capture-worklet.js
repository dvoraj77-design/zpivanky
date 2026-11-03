// AudioWorklet: jen sbírá vzorky z mikrofonu a posílá je po blocích do analyzačního workeru.
// Detekce výšky běží mimo zvukové vlákno, aby doprovod nikdy nepraskal.
class ZpCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port2 = null;
    this.chunk = 512;
    this.buf = new Float32Array(this.chunk);
    this.n = 0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'port') this.port2 = e.data.port;
    };
  }
  process(inputs) {
    const inp = inputs[0];
    if (inp && inp.length && this.port2) {
      const ch0 = inp[0];
      const ch1 = inp.length > 1 ? inp[1] : null;
      for (let i = 0; i < ch0.length; i++) {
        this.buf[this.n++] = ch1 ? 0.5 * (ch0[i] + ch1[i]) : ch0[i];
        if (this.n === this.chunk) {
          // čas konce bloku v čase AudioContextu
          const tEnd = currentTime + (i + 1) / sampleRate;
          this.port2.postMessage({ type: 'chunk', samples: this.buf, t: tEnd }, [this.buf.buffer]);
          this.buf = new Float32Array(this.chunk);
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('zp-capture', ZpCapture);
