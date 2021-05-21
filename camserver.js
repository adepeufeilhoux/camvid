import { spawn } from 'child_process';
import http from 'http';
import { readFile } from 'fs';

//var child = spawn('/opt/vc/bin/raspivid', ['-hf', '-w', '1280', '-h', '1024', '-t', '99999999', '-fps', '20', '-b', '500000', '-o', '-']);
//	child.stdout.pipe(response);

const helpHTML = "<h1>Usage</h1>" +
	"<ul>" +
		"<li><b>/start</b>: start the camera</li>" +
		"<li><b>/stop</b>: stop the camera</li>" +
		"<li><b>/stream</b>: image stream (when camera is started)</li>" +
	"</ul>";

/*
const videoHTML = "<h1>Video</h1>" +
	"<video autoplay='true' controls='true'>" +
		"<source src='http://rasp2:8080/stream' type='video/mp4'>"
	"</video>";
*/

const raspividCommand = '/opt/vc/bin/raspivid';
const raspividCommandArgs = [
	'-a', '12', // Enable/Set annotate flags or text (12 -> with time and date)
	'-t', '0',  // Time (in ms) to capture for. If not specified, set to 5s. Zero to disable
	'-w', '1280', // Set image width <size>
	'-h', '720', // Set image height <size>
	'-ih', // Insert inline headers (SPS, PPS) to stream
	'-fps', '30', // Specify the frames per second to record
	'-o', '-']; // output

var ffmpegCommand = "/usr/bin/ffmpeg";
var ffmpegCommandArgs = [
	'-i', '-', // read the input from stdin
//	'-f', 'h264', // input format
	'-c', 'copy', // transformation
	'-f', 'mpegts', // output format
	'-movflags', 'frag_keyframe+empty_moov', // ?
	'-'
//	'rtsp://192.168.10.191:5000'
];

var raspivid = null;
var converter = null;
var videoHTML = null;

function startStreaming() {
	console.log("STREAMING");

	raspivid = spawn(raspividCommand, raspividCommandArgs);

	raspivid.stderr.on('data', (data) => {
		console.log("raspivid stderr: " + data);
	});

	raspivid.on('exit', (code) => {
		console.log("raspivid exited with code " + code);
	});

	converter = spawn(ffmpegCommand, ffmpegCommandArgs);
	raspivid.stdout.pipe(converter.stdin);

	converter.stderr.on('data', (data) => {
		console.log("raspivid stderr: " + data);
	});

	converter.on('exit', (code) => {
		console.log("raspivid exited with code " + code);
	});
}


var server = http.createServer(function(request, response) {
	switch (request.url) {
		case '/start':
			console.log("START");
			startStreaming();
			response.writeHead(200, "OK");
			response.end("Stream started");
			break;
		case '/stop':
			console.log("STOP");
			raspivid.kill();
			converter.kill();
			raspivid = null; converter = null;
			response.writeHead(200, "OK");
			response.end("Stream stopped");
			break;
		case '/stream':
			if (raspivid == null) { startStreaming(); }
			response.setHeader('Content-Type', 'video/mpeg');
			console.log("STREAM");
			converter.stdout.pipe(response);
			break;
		case '/camvid':
			console.log("CAMVID");
			response.setHeader('Content-Type', 'text/html');
			response.writeHead(200, "OK");
			response.end(videoHTML);
			break;
		default:
			console.log("DEFAULT");
			response.writeHead(400, "Bad request");
			response.end(helpHTML);
			return;
	}
});

readFile("camvid.html", (err, data) => {
	if (err != null) {
        console.error(`Could not read camvid.html file: ${err}`);
        process.exit(1);
	} else {
		videoHTML = data;
		server.listen(8080, () => {
			console.log("server listening on port 8080");
		});
	}});

