'use strict';

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

var audioBufferQueue = [];
var responseQueue = [];
var directivesQueue = [];
var mp3Queue = [];
var audioPlayer = document.getElementById('audio');

ws.onmessage = function (event) {
  const data = event.data;
  const isArrayBuffer = Object.prototype.toString.call(data) === '[object ArrayBuffer]';
  console.log('Got data:', event, data, data.byteLength);

  if (!isArrayBuffer) {
    let response = {};

    try {
      response = JSON.parse(data);
    } catch(error) {
      console.log(error);
    }

    let headers = response.headers;
    let body = response.body;

    if (headers['Content-Type'] === 'application/json') {
      try {
        body = JSON.parse(body);
      } catch(error) {
        console.log(error);
      }

      console.log('body', body);

      /*
       * directive.
       * { namespace: 'AudioPlayer',
       *   name: 'clearQueue',
       *     payload: { clearBehavior: 'CLEAR_ENQUEUED' } }
       **/

      var directives = _.get(body, ['messageBody', 'directives'], []);

      var playing = false;

      for (var i = 0; i < directives.length; i++) {
        var directive = directives[i];
        if (_.get(directive, 'name') === 'speak') {
          if (!playing) {
            setTimeout(function() {
              play(_.get(directive, ['payload', 'audioContent'], '').replace('cid:', ''));
              directives.splice(i, 1);
            }, 200);
          }
        }

        if (_.get(directive, 'name') === 'play' && _.get(directive, 'namespace') === 'AudioPlayer') {
          var streams = _.get(directive, ['payload', 'audioItem', 'streams']);

          if (_.size(streams)) {
            streams.forEach(function(stream) {
              if (stream.streamMp3Urls) {
                mp3Queue = stream.streamMp3Urls;
                audioPlayerPlay();
              }
            });
          }
        }
      }
    } else {
      responseQueue.push(headers);
    }
  }

  if (isArrayBuffer) {
    audioBufferQueue.push(data);
  } else {

  }
};

var source = null;

function play(identifier) {
  var data = responseQueue.reduce(function(acc, o, i) {
    var contentId = _.get(o, 'Content-ID', '');
    if (contentId && contentId.indexOf(identifier) > -1) {
      responseQueue.splice(i, 1);
      return audioBufferQueue.splice(i, 1)[0];
    }
    return acc;
  }, null);

  if (data) {
    audioContext.decodeAudioData(data, function(buffer) {
      console.log('Decoded buffer:', buffer);

      if (source) {
        source.stop();
      }

      source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);

      source.onended = function() {
        sourceEndHandler(source);
      };
    }, function(err) {
      stateCounter.reset();
      console.error('error', err);
    });
  }
}

function audioPlayerPlay() {
  if (mp3Queue.length) {
    audioPlayer.src = mp3Queue.shift();
    audioPlayer.play();
  }
}

function sourceEndHandler(source) {

}
