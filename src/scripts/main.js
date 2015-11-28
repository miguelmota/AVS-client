import $ from 'sprint';
import SpeechToText from './speech-to-text';
import AudioVisualizer from './audio-visualizer';

const visualiztionContainer = document.getElementById('alexa');
const listenButton = document.getElementById('listenButton');
const speechToText = new SpeechToText('#speech-results');
const audioVisualizer = new AudioVisualizer(visualiztionContainer);

const host = window.document.location.host.replace(/:.*/, '');
const ws = new WebSocket('ws://' + host + ':8080');
ws.binaryType = 'arraybuffer';

const audioContext = new AudioContext();

const KEYS = {
  SPACEBAR: 32,
  ESC: 27
};

const stateCounter = (function() {
  var state = 0;

  return {
    incr: function() {
      state += 1;
    },
    reset: function() {
      state = 0;
    },
    count: function() {
      return state;
    }
  };
})();

const UI = (function() {
  const $visualizationContainer = $(visualiztionContainer);
  const $listenButton = $(listenButton);
  let isListening = false;

  return {
    toggleListening: function() {
      if (isListening) {
        speechToText.finishListening();
      } else {
        speechToText.startListening();
      }

      // TODO - add only one class
      $visualizationContainer.toggleClass('listening');
      $listenButton.toggleClass('listening');
      isListening = !isListening;
    },

    startListening: function() {
      if (!isListening) {
        isListening = true;

        speechToText.startListening();

        $visualizationContainer.addClass('listening');
        $listenButton.addClass('listening');
      }
    },

    stopListening: function() {
      if (isListening) {
        isListening = false;
        speechToText.finishListening();

        $visualizationContainer.removeClass('listening');
        $listenButton.removeClass('listening');
      }
    },

    isListening: function() {
      return isListening;
    }
  };
})();

const audioRecorder = (function() {
  var recorder;

  function blobToBase64(blob, cb) {
    var reader = new FileReader();
    reader.onload = function() {
      var dataUrl = reader.result;
      var base64 = dataUrl.split(',')[1];
      cb(base64);
    };
    reader.readAsDataURL(blob);
  }

  function wavExportCallback(data) {
    console.log('WAV Export:', data);

    blobToBase64(data, function(base64) {
      ws.send(JSON.stringify({
        state: stateCounter.count(),
        data: base64
      }));
    });
  }

  return {
    startRecording: function() {
      if (!recorder) {
        return false;
      }
      if (recorder.isRecording) {
        return false;
      }

      recorder.record();
      recorder.isRecording = true;
    },

    stopRecording: function() {
      if (!recorder) {
        return false;
      }

      recorder.stop();
      recorder.exportWAV(wavExportCallback);
      recorder.clear();
      recorder.isRecording = false;
    },

    connect: function(mediaStream) {
      recorder = new Recorder(mediaStream, {
        workerPath: '/scripts/recorderWorker.js',
        numChannels: 1
      });
    },

    _getRecorder: function() {
      return recorder;
    }
  };
})();

const keyboardTimeoutManager = (function() {
  const KEY_DOWN_TIMEOUT = 350;
  var keyDownTimeout;

  return {
    clearTimeout: function() {
      if (keyDownTimeout) {
        window.clearTimeout(keyDownTimeout);
      }

      keyDownTimeout = null;
    },

    getKeyDownTimeout: function() {
      return keyDownTimeout;
    },

    setKeyDownTimeout: function(timeout) {
      keyDownTimeout = timeout;
      return keyDownTimeout;
    },

    KEY_DOWN_TIMEOUT: KEY_DOWN_TIMEOUT
  };
})();

window.addEventListener('keydown', function(e) {
  if (e.keyCode === KEYS.SPACEBAR) {
    if (!UI.isListening()) {
      audioRecorder.startRecording();
    }

    if (!keyboardTimeoutManager.getKeyDownTimeout()) {
      let timeout = setTimeout(function() {
        keyboardTimeoutManager.clearTimeout();
        stateCounter.incr();
        UI.startListening();
      }, keyboardTimeoutManager.KEY_DOWN_TIMEOUT);

      keyboardTimeoutManager.setKeyDownTimeout(timeout);
    }
  }
}, false);

document.addEventListener('keyup', function(e) {
  if (e.keyCode === KEYS.SPACEBAR) {
    keyboardTimeoutManager.clearTimeout();
    audioRecorder.stopRecording();
    UI.stopListening();
  }
  if (e.keyCode === KEYS.ESC) {
    keyboardTimeoutManager.clearTimeout();
    UI.stopListening();
    stateCounter.reset();
  }
}, false);

audioVisualizer.start();

// Set correct getUserMedia
navigator.getUserMedia = navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia;

// set correct AudioContext
window.AudioContext = window.AudioContext || window.webkitAudioContext;

// Get audio stream from microphone
navigator.getUserMedia({ audio: true }, (stream) => {
    audioVisualizer.setSource(stream);
    audioRecorder.connect(audioContext.createMediaStreamSource(stream));
  }, function (error) {
    console.error(error);
  });

ws.onmessage = function (event) {
  console.log('Got data:', event.data, event.data.byteLength);
  const shouldSpeak = true;

  if (shouldSpeak) {
    audioContext.decodeAudioData(event.data, function(buffer) {
      console.log('Decoded buffer:', buffer);

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
    }, function(err) {
      stateCounter.reset();
      console.error('error', err);
    });
  }
};
