import { StreamCamera, Codec } from "pi-camera-connect";
//import * as fs from "fs";
import http from 'http';
import { Converter } from 'ffmpeg-stream';

const runApp = async () => {

    const streamCamera = new StreamCamera({
        codec: Codec.H264
    });

    const converter = new Converter();

    const videoStream = streamCamera.createStream();

    const converterInput = converter.createInputStream({
	    f: 'video4linux2',
	    input_format: 'h264',
	    vcodec: 'mjpeg'
    });

    const converterOutput = converter.createOutputStream({
	    f: 'mp4',
	    vcodec: 'mjpeg',
	    vf: 'crop=300:300,scale=100:100'
    });



//    const writeStream = fs.createWriteStream("video-stream.h264");

    // Pipe the video stream to our video file
//    videoStream.pipe(writeStream);


    // We can also listen to data events as they arrive
//    videoStream.on("data", data => console.log("New data", data));
 //   videoStream.on("end", data => console.log("Video stream has ended"));

    // start server
    http.createServer((request, response) => {
    	    console.log("Start stream");
    	    streamCamera.startCapture();
	    converter.run();
    	    videoStream.pipe(converterInput);
	    converterOutput.pipe(response);
    }).listen(8080);

    // Wait for 5 seconds
    await new Promise(resolve => setTimeout(() => resolve(), 20000));

    await streamCamera.stopCapture();
};

runApp();
