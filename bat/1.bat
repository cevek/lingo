:ffmpeg -y -i 1.mp3 -ac 1 -ar 10000 1.wav
:sox 1.wav -n trim 000 100 spectrogram -y 128 -X 50 -r -o s0.png
:sox 1.wav -n trim 100 100 spectrogram -y 128 -X 50 -r -o s1.png
:sox 1.wav -n trim 200 100 spectrogram -y 128 -X 50 -r -o s2.png



:convert spectrogram.png -negate -channel G -separate  -resize 5000x35! 1.png
:convert ( ( spectrogram.png -negate -channel G -separate -contrast -resize 15000x35! -crop x30+0+3 +repage ) ( 100.bmp -brightness-contrast +100 ) -compose Bumpmap -geometry +0+0  -composite ) 2.png

:Video Images
:convert ( 1/* -resize x50 -gravity Center -crop 100x+0+0 +repage ) -level 0%,100%,2.0 -append thumbs_.jpg



convert -define compose:outside-overlay=false -size 30000x30 xc:white  ( ( s*.png +append -negate -channel G -separate -brightness-contrast 0x100 -resize x35! -crop x30+0+3 +repage ) ( timing.bmp -brightness-contrast +70 -geometry +0+2 ) -compose Bumpmap  -composite ) -compose CopyOpacity -composite -channel A -negate ../2.png





:convert -define compose:outside-overlay=false 2.png 100.bmp -compose CopyOpacity -geometry +0+1 -composite 3.png

:convert -size 5000x30 xc:white 100.bmp -compose CopyOpacity -composite  2.png


