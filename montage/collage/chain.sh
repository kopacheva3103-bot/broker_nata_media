#!/bin/bash
cd /tmp/claude-0/col
mixit(){ # $1 workdir
  D=$(python3 -c "import subprocess;print(round(float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0','$1/talk.mp4'],capture_output=True,text=True).stdout)+0.6,2))")
  E=$(python3 -c "print($D-2)")
  ffmpeg -v error -y -i $1/talk.mp4 -i music/stylz.mp3 -filter_complex "[0:a]apad=whole_dur=$D[v];[1:a]atrim=0:$D,volume=0.07,afade=t=in:d=1,afade=t=out:st=$E:d=2[m];[v][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]" -map "[a]" -c:a pcm_s16le $1/mix.wav
  I=$(ffmpeg -v info -i $1/mix.wav -af ebur128 -f null - 2>&1 | grep -A1 "Integrated loudness" | grep -oE "I: +-?[0-9.]+" | grep -oE "\-?[0-9.]+")
  G=$(python3 -c "print(-14-($I))")
  ffmpeg -v error -y -i $1/collage_video.mp4 -i $1/mix.wav -map 0:v -map 1:a -c:v copy -af "volume=${G}dB,alimiter=limit=0.97" -c:a aac -b:a 192k -shortest -movflags +faststart $1/collage_full.mp4
  echo "$1 done $(date +%H:%M)"
}
while pgrep -f "collage.py work src" >/dev/null; do sleep 15; done
echo "reel1 render finished $(date +%H:%M)"
REEL=reels/reel2.py python3.13 collage.py work2 src x.mp4 > work2/render.log 2>&1; mixit work2
while [ ! -s work3/matte.mp4 ] || pgrep -f "matte.py" >/dev/null; do sleep 15; done
REEL=reels/reel3.py python3.13 collage.py work3 src x.mp4 > work3/render.log 2>&1; mixit work3
echo ALL_DONE
