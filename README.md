# Alexa Voice Service Client App

> Front-end application for interacting with [Alexa Voice Service](https://developer.amazon.com/appsandservices/solutions/alexa/alexa-voice-service).

<img src="./src/screenshot.png" width="500">

# What

With this application the user holds the spacebar to speak an utterance. The utterance is base64 encoded and sent over to the AVS server via a web socket. The AVS server sends the response back as binary data via the web socket and is decoded into an audio buffer which is played back to the user.

Here's [AVS server](https://github.com/miguelmota/AVS-server) to use in conjuction.

# Development

Install node modules

```bash
npm install
```

Install bower components

```bash
bower install
```

Run local web server

```bash
gulp
```

Build and minify

```bash
gulp build
```

# Credits & Contributors

[Tim Kendall](https://github.com/timkendall/) for developing awesome UI.

# License

MIT
