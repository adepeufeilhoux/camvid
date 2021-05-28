import { spawn } from 'child_process';
import http from 'http';
import { createReadStream, unlink, watch, access, constants } from 'fs';

const helpHTML = 
	"<html><head><title>CAMVID</title></head>" +
		"<body>" +
		"<h1>Usage</h1>" +
		"<ul>" +
			"<li><b>/start</b>: start the camera</li>" +
			"<li><b>/stop</b>: stop the camera</li>" +
			"<li><b>/stream</b>: image stream (when camera is started)</li>" +
		"</ul>" + 
		"</body>";

const raspividCommand = '/opt/vc/bin/raspivid';
const raspividCommandArgs = [
	'-a', '12', // Enable/Set annotate flags or text (12 -> with time and date)
	'-t', '0',  // Time (in ms) to capture for. If not specified, set to 5s. Zero to disable
	'-w', '1280', // Set image width <size>
	'-h', '720', // Set image height <size>
	'-ih', // Insert inline headers (SPS, PPS) to stream
	'-fps', '30', // Specify the frames per second to record
	'--nopreview',
	'-o', '-']; // output

const m3u8Filename = 'camvid.m3u8';

const ffmpegCommand = "/usr/bin/ffmpeg";
const ffmpegCommandArgs = [
	'-i', '-', // read the input from stdin
//	'-f', 'h264', // input format
	'-c', 'copy', // transformation
	'-f', 'hls', // output format
	'-hls_time', '4', // slices the video and audio into segments with a duration of 4 seconds
	'-hls_flags', 'delete_segments', // slices the video and audio into segments with a duration of 4 seconds
//	'-movflags', 'frag_keyframe+empty_moov', // ?
	m3u8Filename
//	'-'
//	'rtsp://192.168.10.191:5000'
];


var raspivid = null;
var converter = null;
var videoHTML = null;

function startStreaming(raw = false) {
	console.log("STREAMING");

	raspivid = spawn(raspividCommand, raspividCommandArgs);

	raspivid.stderr.on('data', (data) => {
		console.log("raspivid stderr: " + data);
	});

	raspivid.on('exit', (code) => {
		console.log("raspivid exited with code " + code);
	});

	if (!raw) {
		console.log("starting converter");
		
		converter = spawn(ffmpegCommand, ffmpegCommandArgs);
		raspivid.stdout.pipe(converter.stdin);

		converter.stderr.on('data', (data) => {
			console.log("converter stderr: " + data);
		});

		converter.on('exit', (code) => {
			console.log("converter exited with code " + code);
		});
	}
	return m3u8Filename;
}

function pipeFileInResponse(fileName, response) {
	var readStream = createReadStream(fileName);
	readStream.on('open', () => { 
			response.writeHead(200, "OK");
			readStream.pipe(response);
		});
	readStream.on('error', (err) => {
			console.log("couldn't read in " + fileName + ": " + err);
			response.writeHead(500, "Server error");
			response.end();
		});
}

var server = http.createServer(function(request, response) {
	switch (request.url) {
		case '/start':
			console.log("START");
			var mpegSequenceFile = startStreaming();
			response.writeHead(200, "OK");
			response.end(mpegSequenceFile);
			break;
		case '/stop':
			console.log("STOP");
			if (raspivid) raspivid.kill();
			if (converter) converter.kill();
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
		case '/raw':
			console.log("RAW");
			if (raspivid == null) { startStreaming(true); }
//			response.setHeader('Content-Type', 'video/h264');
			raspivid.stdout.pipe(response);
			break;
		case '/camvid.m3u8':
			console.log("CAMVID M3U8");
			if (raspivid != null) {
				access(m3u8Filename, constants.R_OK, (err) => {
					response.setHeader('Content-Type', 'application/x-mpegURL');
					if (err) {
						const ac = new AbortController();
						// wait till m3u8 file exists
						watch(".", { signal: ac.signal }, (eventType, fileName) => {
							console.log(eventType + " event on " + fileName);
							if (fileName === m3u8Filename) {
								pipeFileInResponse('camvid.m3u8', response);
								ac.abort();
							}
						});
					} else {
						pipeFileInResponse('camvid.m3u8', response);
					}
				});
			} else {
				response.writeHead(500, "Streaming not started");
				response.end();
			}
			break;
		default:
			if (request.url.startsWith("/camvid")) {
				console.log("CAMVID FILE: " + request.url.substring(1));
				pipeFileInResponse(request.url.substring(1), response);
			} else {
				console.log("DEFAULT");
				response.writeHead(400, "Bad request");
				response.end(helpHTML);
				return;
			}
	}
});

// delete m3u8 file if present
unlink(m3u8Filename, (err) => {
	if (err) console.log( m3u8Filename + ' not deleted because: ' + err );
});

// start the server
server.listen(8080, () => {
	console.log("server listening on port 8080"); });
