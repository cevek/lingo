$.secondsToTime = function(sec){
	sec = Math.min(359999, Math.max(0, sec));
	var h = sec/3600|0;
	var m = sec/60%60|0;
	var s = sec%60;
	var hh = (h<10 ? "0"+h : h);
	var mm = (m<10 ? "0"+m : m);
	var ss = (s<10 ? "0"+s : s);
	return hh+":"+mm+":"+ss;
}

$.timeToSeconds = function(time){
	var t = time.match(/(\d\d):(\d\d):(\d\d)/) || [0,0,0,0];
	return parseInt(t[1],10)*3600 + parseInt(t[2],10)*60 + parseInt(t[3],10);
}

$.fn.time = function(setSeconds){
	$this = $(this).eq(0);

	if (typeof setSeconds == "number"){
		$this.val($.secondsToTime(parseInt(setSeconds)));
		
		if (!$this.data("timeInput")){
			$this.data("timeInput", true).attr("maxlength", 8).keypress(function(e){
				var val = this.value;
				var pos = this.selectionStart;
				this.selectionEnd = pos;
				if (!val.match(/\d\d:\d\d:\d\d/))
					this.value = '00:00:00';
				// only numbers
				if (e.which >= 48 && e.which <= 57)
					if (pos < 8){
						pos = (pos == 2 || pos == 5 ? pos + 1 : pos)
						var num = String.fromCharCode(e.which);
						if (num > 5 && (pos == 3 || pos == 6))
							num = 5;
						val = val.substr(0, pos) + num + val.substr(pos+1);
						this.value = val;
						this.selectionStart = this.selectionEnd = (pos == 1 || pos == 4 ? pos + 2 : pos + 1);
					}
			}).keydown(function(e){
				var val = this.value;
				var pos = this.selectionStart;
				// backspace
				if (e.which == 8 && pos > 0){
					if (pos != 3 && pos != 6)
						this.value = val.substr(0, pos-1) + "0" + val.substr(pos);
					pos--;
				}
				// delete
				if (e.which == 46 && pos < 8 && pos != 2 && pos != 5)
					this.value = val.substr(0, pos) + "0" + val.substr(pos+1);
				
				if (e.which == 8 || e.which == 46){
					this.selectionStart = this.selectionEnd = pos;
					return false;
				}
			})
		}
		return $(this);
	}
	else {
		return $.timeToSeconds($this.val());
	}
}