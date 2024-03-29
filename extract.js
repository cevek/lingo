var fs = require('fs');
var exec = require("child_process").exec;
var async = require("./async.js").async;

var started_time = 0;

function pr(command, callback) {
	var time = (new Date).getTime();
	var left = time - started_time;
	exec(command, {maxBuffer: 100000000, timeout: 1000000}, function (err, stdout, stderr) {
		time = (new Date).getTime() - time;
		//err = stderr = stdout = "";
		console.log(command, "[" + time + "ms]");
		console.log("<div style='margin-left: " + (left / 80 | 0) + "px; width: " + (time / 80 | 0) + "px; height: 20px; background: red; border: 1px solid black;'></div>");
		//console.log(((err||"") + (stderr||"") + (stdout||"")).replace(/Pos:.*\r/g, ""))
		if (callback)
			callback.call(this, (err + stdout + stderr).replace(/\r/g, ""));
	});
}


function upload(reqtype, file, callback) {
	//console.log("upload: " + reqtype + " / file: " + file);
	if (callback)
		callback();
}

exports.extract = function (ssn, callback) {
	if (ssn.extracting)
		return callback({error: "!extracting"});

	ssn.extracting = true;
	started_time = (new Date).getTime();

	var dir = ssn.processDir;
	var dataDir = ssn.dataDir;
	var video = ssn.video;
	video.mkvfile = dir + "video.mkv";
	video.dur = video.end - video.start;

	console.log("start extracting");

	copyFilesToRAM(function () {
		// parallel actions
		async(
			function (cb) {
				extractVideo(function () {
					extractThumbs(cb);
				});
			},
			function (cb) {
				extractMkvSubs(function () {
					processSubs(cb);
				});
			},
			function (cb) {
				var fn = ssn.enAudio.videoStream ? extractAudioFromVideo : extractAudioFromFile;
				fn("enAudio", function () {
					processAudio("enAudio", cb);
				});
			},
			function (cb) {
				var fn = ssn.ruAudio.videoStream ? extractAudioFromVideo : extractAudioFromFile;
				fn("ruAudio", function () {
					processAudio("ruAudio", cb);
				});
			},
			function (cb) {
				processSubs(cb);
			},
			function () {// when done
				console.log("CONVERT DONE");
				console.log("Extracting time: ", (new Date() - started_time) / 1000 | 0, "s");
				console.log(ssn);
			}
		)
	});

	function enAudioDone() {
		joinVideoEnAudio(function () {
			upload("video", function(){

			});
		});
	}


	function copyFilesToRAM(callback) {
		exec("cp " + video.file + " " + dir, function (a, b, c) {
			console.log("copy result", a, b, c);
			video.file = dir + "video";
			callback();
		});

		/*var rs = fs.createReadStream(video.file);
		 var ws = fs.createWriteStream(dir + "video");
		 rs.pipe(ws);
		 ws.on("close", function(){
		 console.log("copy done");
		 video.file = dir + "video";
		 callback();
		 });*/
	}

	function extractVideo(callback) {
		pr("mencoder " + video.file + " -ss " + video.start + " -endpos " + video.dur + " -of lavf -nosound -ovc copy -o " + video.mkvfile + " 2>&1", callback);
	}


	function extractMkvSubs(callback) {
		if (ssn.enSub.videoStream || ssn.ruSub.videoStream) {
			console.log("prepare mkv for mkvextract");
			var buffer = new Buffer(32768);
			var fd = fs.openSync(video.file, "r");
			fs.readSync(fd, buffer, 0, 32768);
			fs.closeSync(fd);

			var mkv_subs_video = video.file + "_subs.mkv";
			var rs = fs.createReadStream(video.file, {start: video.startpos, end: video.endpos});
			var ws = fs.createWriteStream(mkv_subs_video);
			ws.write(buffer);
			rs.pipe(ws);
			ws.on("close", function () {
				var params = "";
				if (ssn.enSub.videoStream) {
					ssn.enSub.file = dataDir + "enSub.srt";
					params += (ssn.enSub.videoStream + 1) + ":" + ssn.enSub.file + " ";
				}
				if (ssn.ruSub.videoStream) {
					ssn.ruSub.file = dataDir + "ruSub.srt";
					params += (ssn.ruSub.videoStream + 1) + ":" + ssn.ruSub.file + " ";
				}
				pr("mkvextract tracks " + mkv_subs_video + " " + params, function () {
					exec("rm " + mkv_subs_video);
					callback();
				});
			})
		}
		else
			callback();
	}

	function extractAudioFromFile(type, callback) {
		var audio = ssn[type];
		audio.file = dir + type + ".wav";
		pr("ffmpeg -i " + audio.uploadfile + " -y " + audio.file, callback);
	}

	function extractAudioFromVideo(type, callback) {
		var stream_id = ssn[type].videoStream;
		if (!stream_id) {
			callback();
			return;
		}
		var audio = ssn[type];
		var aid = video.streams[stream_id].aid;

		audio.tmpfile = dir + stream_id;
		audio.channels = video.streams[stream_id].channels;
		audio.format = video.streams[stream_id].format;

		// with audio mencoder "D:\A.Perfect.World.1993.x264.tRuAVC.mkv" -ss 86:30 -endpos 60 -of lavf -ovc copy -aid 5 -mc 0 -noskip -oac copy -fafmttag 0x706D -o 0.mp4
		pr("mencoder " + video.file + " -ss " + video.start + " -endpos " + video.dur + " -of rawaudio -aid " + aid + " -oac pcm -channels " + audio.channels + " -ovc copy -o " + audio.tmpfile, function () {
			var fd = fs.openSync(audio.tmpfile, "r+");
			var size = fs.fstatSync(fd).size;

			var wavheader = new Buffer([
				82, 73, 70, 70, /*RIFF*/38, 169, 14, 0, /*chunksize*/87, 65, 86, 69, /*WAVE*/102, 109, 116, 32, /*fmt */
				18, 0, 0, 0, /*subchunk1size*/1, 0, /*audioformat*/1, 0, /*channels*/128, 187, 0, 0, /*samplerate*/
				0, 119, 1, 0, /*byterate*/2, 0, /*blockalign*/16, 0, /*bitspersample*/0, 0, /*extra*/
				100, 97, 116, 97, /*data*/0, 0, 0, 0/*subchunk2size*/]);

			if (size > 46) {
				// вставляем в wav header размер файла и колво каналов
				wavheader.writeUInt32LE(size - 46, 42);
				wavheader.writeUInt16LE(audio.channels, 22);
				fs.writeSync(fd, wavheader, 0, 46, 0);
			}
			fs.closeSync(fd);
			callback();
		});
	}

	function processSubs(callback) {
		//var sub = ssn[type];
		callback();
	}

	function processAudio(type, callback) {
		var audio = ssn[type];
		audio.file = dir + type + ".wav";
		audio.fileslow = dir + type + "_slow.wav";
		audio.mp3file = dataDir + type + ".mp3";
		audio.mp3fileslow = dataDir + type + "_slow.mp3";
		audio.oggfile = dataDir + type + ".ogg";
		/*
		 var channels = " -channels 1 ";
		 if (audio_streams[i].channels == 6)
		 channels = " -channels 6 -af pan=1:0:0:0:0:1 ";
		 */

		// extract center channel if exists, make RMS volume, cut < 100Hz
		pr("sox " + audio.tmpfile + " -c 1 " + audio.file + " remix " + (audio.channels == 6 ? 4 : 1) + " compand 0.3,1 6:-70,-60,-20 -5 -90 0.2 bass -10", function () {
			//pr("sox "+audio.tmpfile+" -c 1 "+audio.file+" remix "+(audio.channels==6 ? 4 : 1)+"", function(){
			async(
				function (soxffmpegcb) {
					// make spectrogram
					if (type == "enAudio") {
						var p = async();
						for (var j = 0; j < Math.ceil(audio.selectDuration / 100); j++)
							p.push(j, function (k, soxcb) {
								pr("sox " + audio.file + " -n trim " + (k * 100) + " 100 rate 4k bass -20 200 spectrogram -r -X 50 -x 5000 -y 64 -z 92 -o " + dir + k + "_.png", function () {
									pr("convert " + dir + k + "_.png -channel G -negate +channel -channel R -blur 0x3 +channel -channel B -blur 0x3 -negate +channel -flip -rotate 90 " + dir + k + "__.png", soxcb);
								});
							});
						p.done(function () {
							pr("montage " + dir + "*__.png -tile x1 -geometry +0+0 -gravity north " + dataDir + "spectrogram.png", function () {
								exec("rm " + dir + "*_.png");
								upload("spectrogram", dataDir + "spectrogram.png", soxffmpegcb);
							});
						});
					}
					else soxffmpegcb();
				},
				function (soxffmpegcb) {
					// convert to mp3
					async(
						function (cb) {
							pr("lame --nores -m m --noreplaygain -b 128k  " + audio.file + " " + audio.mp3file, function () {
								upload("audio", audio.mp3file, cb);
								if (type == "enAudio")
									enAudioDone();
							})
						},
						function (cb) {
							if (type == "enAudio")
								pr("sox " + audio.file + " " + audio.fileslow + " speed 0.75 pitch 150", function () {
									pr("lame --nores -m m --noreplaygain -b 128k  " + audio.fileslow + " " + audio.mp3fileslow, function () {
										upload("slowaudio", audio.mp3fileslow, cb);
									})
								});
							else cb();
						},
						soxffmpegcb
					);
				},
				callback);


			/*// convert to ogg
			 parallel_audio++;
			 pr("ffmpeg -y -i "+audio.file+" -ab 96k -ac 1 -c:a libvorbis "+audio.oggfile, function(){
			 upload("audio", audio.oggfile, _callback_audio);
			 })*/
		})
	}

	function extractThumbs(callback) {
		var video = ssn.video;
		// extract thumbs
		//-vf scale=-1:200,crop=min\\(iw\\\\,320\\):200
		var dur = 60;
		var p = async();
		for (var i = 0; i < Math.ceil(video.dur / 60); i++)
			p.push(i, function (i, cb) {
				pr("ffmpeg -y -ss " + i * dur + " -t " + dur + " -i " + video.mkvfile + " -vf scale=-1:50,crop=min\\(iw\\\\,100\\):50 -qscale 1 -vsync 1 -r 1 " + dir + "_video" + i + "%03d_.jpg", cb);
			});
		p.done(function () {
			pr("convert " + dir + "_*.jpg -auto-level -level 0,60%% -modulate 100,70 " + dir + "_vv.jpg", function () {
				pr("montage " + dir + "_vv*.jpg  -tile 20x -geometry +0+0 -gravity north " + dataDir + "thumbs.jpg", function () {
					exec("rm " + dir + "_*.jpg");
					upload("thumb", dataDir + "thumbs.jpg", callback);
				});
			});
		});
	}

	function joinVideoEnAudio(callback) {
		ssn.videoEn = dataDir + "videoEn.mkv";
		pr("mencoder -audiofile " + ssn.enAudio.mp3file + " " + ssn.video.mkvfile + " -of lavf -oac copy -ovc copy -o " + ssn.videoEn, function () {
			exec("rm " + dir + "*", function () {
				upload("video", ssn.videoEn, callback);
			});
		});
	}
};