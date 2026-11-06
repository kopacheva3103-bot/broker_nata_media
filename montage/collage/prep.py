import sys,json,subprocess
from pathlib import Path
sys.path.insert(0,"/home/user/broker_nata_media")
from montage import cleanup
src,out=sys.argv[1],Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
dur=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",src],capture_output=True,text=True).stdout)
words=cleanup.transcribe_cached(src,out,"small","ru")
keep,cuts=cleanup.plan_cuts(words,dur,{"max_pause":0.35,"cut_retakes":True},30)
rw=cleanup.remap(words,keep)
cleanup.report(cuts,out/"cuts.txt",src)
v,a=cleanup.select_filters(keep)
SP=1.1
subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-filter_complex",
  f"[0:v]setpts=PTS-STARTPTS,fps=30,{v},setpts=PTS/{SP}[v];[0:a]{a},atempo={SP}[a]",
  "-map","[v]","-map","[a]","-c:v","libx264","-crf","16","-preset","veryfast","-c:a","aac","-b:a","192k",str(out/"talk.mp4")],check=True)
json.dump([[round(s/SP,3),round(e/SP,3),w] for s,e,w in rw],open(out/"words.json","w"),ensure_ascii=False)
print(len(keep),"keep;",round(sum(e-s for s,e in keep)/SP,1),"s")
