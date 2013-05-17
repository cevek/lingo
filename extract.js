var fs = require('fs');
var exec = require("child_process").exec;

var started_time=0;

function pr(command, callback){
	var time = (new Date).getTime();
	var left = time - started_time;
	exec(command, {maxBuffer: 100000000, timeout: 1000000}, function(err,stdout,stderr){
		time = (new Date).getTime() - time;
		//err = stderr = stdout = "";
		console.log(command, "["+time+"ms]");
		console.log("<div style='margin-left: "+(left/80|0)+"px; width: "+(time/80|0)+"px; height: 20px; background: red; border: 1px solid black;'></div>");
		//console.log(((err||"") + (stderr||"") + (stdout||"")).replace(/Pos:.*\r/g, ""))
		if (callback)
			callback.call(this, (err + stdout + stderr).replace(/\r/g, ""));
	});
}


function upload(reqtype, file, callback){
	console.log("upload: "+reqtype+" / file: "+file);
	callback();
}

exports.extract = function(ssn, callback)
{
	if (ssn.extracting)
		return callback({error: "!extracting"});

	ssn.extracting = true;
	started_time = (new Date).getTime();

	var parallel = 0;
	function _callback(){
		if (--parallel) return;
		joinVideoAudio(ssn, function(){
			console.log("CONVERT DONE");
			console.log(ssn);
			callback();
		});
	}
	parallel++;
	extractVideoContainer(ssn, _callback);
	/*
	 parallel++;
	 extractAudioContainer(ssn, "enAudio");
	 parallel++;
	 extractAudioContainer(ssn, "ruAudio");

	 parallel++;
	 processSub(ssn, "enSub");
	 parallel++;
	 processSub(ssn, "ruSub");
	 */
}

function extractVideoContainer(ssn, callback)
{
	var video = ssn["video"];
	video.mkvfile = ssn.dir + "video.mkv";
	var dir = ssn.dir;
	var dur = video.end - video.start;

	var parallel = 0;
	function _callback(){
		if (--parallel) return;
		console.log("extractVideoContainer done"+parallel);
		callback();
	}

	// extract no sound video

	// mencoder "D:\A.Perfect.World.1993.x264.tRuAVC.mkv" -ss 86:30 -endpos 60 -of lavf -ovc copy -aid 5 -mc 0 -noskip -oac copy -fafmttag 0x706D -o 0.mp4
	parallel++;
	pr("mencoder "+video.file+" -ss "+video.start+" -endpos "+dur+" -of lavf -nosound -ovc copy -o "+video.mkvfile+" 2>&1", function(){
		processVideo(ssn, _callback);
	});

	// extract audio files to wave
	if (ssn.enAudio.videoStream){
		parallel++;
		_extractAudio(ssn.enAudio.videoStream, "enAudio");
	}
	if (ssn.ruAudio.videoStream){
		parallel++;
		_extractAudio(ssn.ruAudio.videoStream, "ruAudio");
	}

	function _extractAudio(stream_id, new_type){
		var audio = ssn[new_type];
		var aid = video.streams[stream_id].aid;

		audio.tmpfile = dir+stream_id;
		audio.channels = video.streams[stream_id].channels;
		audio.format = video.streams[stream_id].format;

		pr("mencoder "+video.file+" -ss "+video.start+" -endpos "+dur+" -of rawaudio -aid "+aid+" -oac pcm -channels "+audio.channels+" -ovc copy -o "+audio.tmpfile, function(){
			var fd = fs.openSync(audio.tmpfile, "r+");
			var size = fs.fstatSync(fd).size;

			var wavheader = new Buffer([
				82,73,70,70,/*RIFF*/38,169,14,0,/*chunksize*/87,65,86,69,/*WAVE*/102,109,116,32,/*fmt */
				18,0,0,0,/*subchunk1size*/1,0,/*audioformat*/1,0,/*channels*/128,187,0,0,/*samplerate*/
				0,119,1,0,/*byterate*/2,0,/*blockalign*/16,0,/*bitspersample*/0,0,/*extra*/
				100,97,116,97,/*data*/0,0,0,0/*subchunk2size*/]);

			if (size > 46){
				// вставляем в wav header размер файла и колво каналов
				wavheader.writeUInt32LE(size-46, 42);
				wavheader.writeUInt16LE(audio.channels, 22);
				fs.writeSync(fd, wavheader, 0, 46, 0);
			}
			fs.closeSync(fd);
			processAudio(ssn, new_type, _callback);
		});
	}


	// extract mkv subs
	parallel += (ssn.enSub.videoStream ? 1 : 0) + (ssn.ruSub.videoStream ? 1 : 0);
	if (ssn.enSub.videoStream || ssn.ruSub.videoStream){
		console.log("prepare mkv for mkvextract");
		var buffer = new Buffer(32768);
		var fd = fs.openSync(video.file, "r");
		fs.readSync(fd, buffer, 0, 32768);
		fs.closeSync(fd);
		var rs = fs.createReadStream(video.file, {start: video.startpos, end: video.endpos});
		var ws = fs.createWriteStream(video.file+".mkv");
		ws.write(buffer);
		rs.pipe(ws);
		ws.on("close", function(){
			var params = "";
			if (ssn.enSub.videoStream){
				ssn.enSub.file = ssn.dir + "enSub.srt";
				params += (ssn.enSub.videoStream+1)+":"+ssn.enSub.file+" ";
			}
			if (ssn.ruSub.videoStream){
				ssn.ruSub.file = ssn.dir + "ruSub.srt";
				params += (ssn.ruSub.videoStream+1)+":"+ssn.ruSub.file+" ";
			}
			pr("mkvextract tracks "+video.file+".mkv "+params, function(){
				exec("rm "+video.file+".mkv");
				if (ssn.enSub.videoStream)
					processSub(ssn, "enSub", _callback);
				if (ssn.ruSub.videoStream)
					processSub(ssn, "ruSub", _callback);
			});
		})
	}
}

function extractAudioContainer(ssn, type, callback)
{
	var audio = ssn[type];
	audio.file = ssn.dir + type + ".wav";
	pr("avconv -i "+audio.uploadfile+" -y "+audio.file, callback);
}

function processSub(ssn, type, callback)
{
	var sub = ssn[type];
	callback();
}

function processAudio(ssn, type, callback)
{
	var audio = ssn[type];
	audio.file = ssn.dir + type + ".wav";
	audio.mp3file = ssn.dir + type + ".mp3";
	audio.oggfile = ssn.dir + type + ".ogg";
	var dir = ssn.dir;
	/*
	 var channels = " -channels 1 ";
	 if (audio_streams[i].channels == 6)
	 channels = " -channels 6 -af pan=1:0:0:0:0:1 ";
	 */

	var parallel_audio = 0;
	function _callback_audio(){
		if (--parallel_audio) return;
		console.log("audio["+type+"] converting done");
		callback();
	}

	// extract center channel if exists, make RMS volume, cut < 100Hz
	pr("sox "+audio.tmpfile+" -c 1 "+audio.file+" remix "+(audio.channels==6 ? 4 : 1)+" compand 0.3,1 6:-70,-60,-20 -5 -90 0.2 bass -10", function(){
	//pr("sox "+audio.tmpfile+" -c 1 "+audio.file+" remix "+(audio.channels==6 ? 4 : 1)+"", function(){
		// make spectrogram
		if (type == "enAudio"){
			var parallel_im = 0;
			function _callback_im(){
				if (--parallel_im) return;
				pr("montage "+dir+"*__.png -tile x1 -geometry +0+0 -gravity north "+dir+"spectrogram.png", function(){
					exec("rm "+dir+"*_.png");
					upload("spectrogram", dir+"spectrogram.png", _callback_audio);
				});
			}

			parallel_audio++;
			for (var j=0; j<Math.ceil(audio.selectDuration/100); j++){
				parallel_im++;
				(function(){
					var k = j;
					pr("sox "+audio.file+" -n trim "+(k*100)+" 100 rate 4k bass -20 200 spectrogram -r -X 50 -x 5000 -y 64 -z 92 -o "+dir+k+"_.png", function(){
						pr("convert "+dir+k+"_.png -channel G -negate +channel -channel R -blur 0x3 +channel -channel B -blur 0x3 -negate +channel -flip -rotate 90 "+dir+k+"__.png", _callback_im);
					});
				})()
			}
		}

		// convert to mp3
		// todo:maybe aac?
		parallel_audio++;
		pr("avconv -y -i "+audio.file+" -ab 96k -ac 1 "+audio.mp3file, function(){
			upload("audio", audio.mp3file, _callback_audio);
		})

		/*// convert to ogg
		 parallel_audio++;
		 pr("avconv -y -i "+audio.file+" -ab 96k -ac 1 -c:a libvorbis "+audio.oggfile, function(){
		 upload("audio", audio.oggfile, _callback_audio);
		 })*/
	})
}

function processVideo(ssn, callback)
{
	var video = ssn.video;
	var dir = ssn.dir;

	// extract thumbs
	pr("avconv -y -i "+video.mkvfile+" -vf scale=-1:200,crop=min\\(iw\\\\,320\\):200 -qscale 1 -vsync 1 -r 1 "+dir+"_video%03d_.jpg", function(){
		pr("convert "+dir+"_*.jpg -auto-level -level 0,60%% -modulate 100,70 "+dir+"_vv.jpg", function(){
			pr("montage "+dir+"_vv*.jpg  -tile 20x -geometry +0+0 -gravity north "+dir+"thumbs.jpg", function(){
				exec("rm "+dir+"_*.jpg");
				upload("thumb", dir+"thumbs.jpg", callback);
			});
		});
	});
}

function joinVideoAudio(ssn, callback)
{
	ssn.videoEn = ssn.dir + "videoEn.mkv";
	pr("mencoder -audiofile "+ssn.enAudio.mp3file+" "+ssn.video.mkvfile+" -of lavf -oac copy -ovc copy -o "+ssn.videoEn, function(){
		exec("rm "+ssn.video.mkvfile);
		upload("video", ssn.videoEn, callback);
	});
}