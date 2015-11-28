import SiriWaveVisualization from './siri-wave-visualization';
import SiriWave9Visualization from './siri-wave9-visualization';

export default class AudioVisualizer {
  constructor (visualizationContainer) {
    /*
     * Setup audio API
     */
    this.audioContext = new AudioContext();
    // Setup analyzer
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    // Setup buffer
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Float32Array(bufferLength);
    /*
     * Setup visualization
     */
    this.visualization = new SiriWave9Visualization({
      container: visualizationContainer,
      width: window.innerWidth,
      height: 200,
      speed: 0.09,
      amplitude: 0.1
    });
  }

  start () {
    this.visualization.start();
    // Start getting audio data
    requestAnimationFrame(() => this._getLatestAudioData());
  }

  setSource (stream) {
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
  }

  _getLatestAudioData () {
    this.analyser.getFloatFrequencyData(this.dataArray);
    this.visualization.setAmplitude(this.dataArray);
    requestAnimationFrame(() => this._getLatestAudioData());
  }
}