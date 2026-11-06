import sys,json,subprocess,numpy as np
from faster_whisper import WhisperModel
m=WhisperModel("small",device="cpu",compute_type="int8")
for f in sys.argv[1:]:
    raw=subprocess.run(["ffmpeg","-v","error","-i",f,"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout
    a=np.frombuffer(raw,np.float32)
    segs,_=m.transcribe(a,language="ru",word_timestamps=True)
    words=[];txt=[]
    for s in segs:
        txt.append(s.text)
        for w in s.words: words.append([round(w.start,2),round(w.end,2),w.word.strip()])
    json.dump(words,open(f+".words.json","w"),ensure_ascii=False)
    print(f, "|", " ".join(txt)[:300])
