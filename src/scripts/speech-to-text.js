import $ from 'sprint';

export default class SpeechToText {
  constructor (textOutputSelector) {
    // Output div
    this.outputDIV = $(textOutputSelector);

    // Speech recognition
    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onstart =  () => {
      console.log('Started listening.');
      this.outputDIV.addClass('listening');
    }

    this.finalTranscript = '';
    this.recognition.onresult = (event) => {
      let interim_transcript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          this.finalTranscript += event.results[i][0].transcript;
        } else {
          interim_transcript += event.results[i][0].transcript;
        }
      }

      // Output resulting transcript
      if (this.finalTranscript.length > 0) this.outputDIV.text(this.finalTranscript)
      else this.outputDIV.text(interim_transcript);
    };

    this.recognition.onerror = (event) => {  }

    this.recognition.onend = () => {
      console.log('Finished listening.')
      this.outputDIV.removeClass('listening');
    }

  }

  startListening () {
    this.finalTranscript = '';
    this.recognition.start();
  }

  finishListening () {
    this.recognition.stop();
  }
}