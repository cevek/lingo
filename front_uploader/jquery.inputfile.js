$.inputfile = function(obj){
	(obj ? $(obj) : $("input:file:visible")).css({position: "absolute", visibility: "hidden"}).wrap("<div style='display:inline-block;'/>")
		.after("<input type='button' class='inputfile_button'> <span style='color: gray; font-style: italic' class='inputfile_hint'></span> <span class='inputfile_name'></span> <span title='Удалить' class='inputfile_remove' style='display: none; cursor: pointer'>&times;</span>")
		// button
		.each(function(){
			$file = $(this);
			var attr = $file.attr("title"); 
			var hint = $file.attr("hint"); 
			$file.next().next().text(hint);
			$file.next().val(attr ? attr : "выбрать файл");
			remakeInput(this);
		}).next().click(function(){
			$(this).prev().click();
		})

	function remakeInput(file, trigger){
		$(file).replaceWith(function(){ 
			file = $(file.outerHTML);		
			return file;
		});
		if (trigger)
			$(file).change()
		$(file).change(change);
	}

	function change(e){
		var file = this;
		var filename = this.value.replace(/C:\\fakepath\\/i, "");
		var m = filename.match(/(.*)\.(.*?)$/i) || ["", "", ""];
		var basename = m[1];
		var ext = m[2];	
		var accept = $(this).attr("accept")+" ";
		if (accept && !accept.match(new RegExp("."+ext+"\\W", "i"))){
			alert("Неверное расширение файла: ." + ext + "\nДопустимые расширения: "+accept);
			remakeInput(file)
			return false;
		}

		var limit = 25;
		basename = (basename.length > limit ? basename.substr(0,limit)+"…" : basename+".") + ext;

		$(this).next().next().hide().next().show().text(basename).attr("title",filename).next().show().click(function(){
			//delete
			$(this).hide().prev().hide().prev().show();
			remakeInput(file, true);
		});

		var pos = 0;
		pos = (ext.match(/(rar|zip|7z|iso|tgz)/i) ? 16 : pos);
		pos = (ext.match(/(pdf|djvu)/i) ? 32 : pos);
		pos = (ext.match(/(docx?|txt|rtf|odt|chm|html?|ppt|srt)/i) ? 48 : pos);
		pos = (ext.match(/(xls|xlsx|csv)/i) ? 64 : pos);
		pos = (ext.match(/(jpe?g|png|gif|bmp|psd|tiff|ico)/i) ? 80 : pos);
		pos = (ext.match(/(mp3|aac|wav|ogg|ac3)/i) ? 96 : pos);
		pos = (ext.match(/(mp4|avi|mkv|wmv|m4v|3gp|flv|mov)/i) ? 112 : pos);
		$(this).next().next().next().prepend("<span class=inputfile_ext style='display: inline-block; margin: 0 3px -3px 0; width: 16px; height: 16px; background: url(inputfile_ext.png) no-repeat left -"+pos+"px'><span>");
	}
}

$(function(){ $.inputfile() });