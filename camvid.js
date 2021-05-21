// remote development: https://www.raspberrypi.org/blog/coding-on-raspberry-pi-remotely-with-visual-studio-code/

// https://www.npmjs.com/package/pi-camera-connect

const { StillCamera } = require("pi-camera-connect");
const fs = require('fs');

const stillCamera = new StillCamera();
stillCamera.takeImage().then( image => {
	fs.writeFileSync("still-image.jpg", image);
});

