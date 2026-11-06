import sys,subprocess,numpy as np,time
from rembg import new_session, remove
from PIL import Image
src,dst=sys.argv[1],sys.argv[2]; W,H=432,768
s=new_session("u2net_human_seg")
dec=subprocess.Popen(["ffmpeg","-v","error","-i",src,"-vf",f"scale={W}:{H}","-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE)
enc=subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","gray","-s",f"{W}x{H}","-r","30","-i","-","-c:v","libx264","-crf","12","-pix_fmt","yuv420p",dst],stdin=subprocess.PIPE)
n=0;t=time.time()
while True:
    b=dec.stdout.read(W*H*3)
    if len(b)<W*H*3: break
    m=remove(Image.frombytes("RGB",(W,H),b),session=s,only_mask=True,post_process_mask=False)
    enc.stdin.write(np.asarray(m.convert("L")).tobytes()); n+=1
    if n%200==0: print(n, round(time.time()-t), flush=True)
enc.stdin.close(); enc.wait(); print("done",n)
