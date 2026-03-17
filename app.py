import base64
import os
import json
import shutil
import yt_dlp
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dictation import evaluate_dictation
from engine import generate_transcript_json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class EvalRequest(BaseModel):
    target_text: str
    user_text: str

class YouTubeRequest(BaseModel):
    url: str

def get_audio_b64(file_path):
    if not os.path.exists(file_path): return ""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode()

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/audio.mp3")
async def serve_audio_1():
    if os.path.exists("audio.mp3"):
        return FileResponse("audio.mp3")
    return {"error": "Không tìm thấy file!"}

@app.get("/audio_2.mp3")
async def serve_audio_2():
    if os.path.exists("audio_2.mp3"):
        return FileResponse("audio_2.mp3")
    return {"error": "Không tìm thấy file!"}

@app.get("/img_1.jpg")
async def serve_img_1():
    if os.path.exists("img_1.jpg"):
        return FileResponse("img_1.jpg")
    elif os.path.exists("img_1.png"):
        return FileResponse("img_1.png")
    return {"error": "Không tìm thấy file!"}

@app.get("/img_2.jpg")
async def serve_img_2():
    if os.path.exists("img_2.jpg"):
        return FileResponse("img_2.jpg")
    elif os.path.exists("img_2.png"):
        return FileResponse("img_2.png")
    return {"error": "Không tìm thấy file!"}

@app.get("/api/default-data")
async def get_default_data(level: int = 1):
    transcript = ""
    translation = ""
    prefill = ""
    
    audio_file = "audio.mp3" if level == 1 else "audio_2.mp3"
    trans_file = "trans.json" if level == 1 else "trans_2.json"
    trans_vi_file = "trans_vi.json" if level == 1 else "trans_vi_2.json"
    
    if os.path.exists(trans_file):
        with open(trans_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        transcript = " ".join(data) 
        
        if level == 1:
            prefill_list = []
            for sentence in data:
                words = sentence.split()
                if len(words) > 2:
                    prefill_list.append(f"{words[0]} {words[1]} ")
                else:
                    prefill_list.append(f"{sentence} ")
            prefill = "\n".join(prefill_list)
    
    if os.path.exists(trans_vi_file):
        with open(trans_vi_file, 'r', encoding='utf-8') as f:
            vi_data = json.load(f)
        translation = " ".join(vi_data)
        
    return {
        "transcript": transcript, 
        "translation": translation,
        "prefill": prefill,
        "audio_src": audio_file
    }

@app.post("/api/evaluate")
async def evaluate(req: EvalRequest):
    if not req.target_text:
        return {"error": "Chưa có dữ liệu bài tập!"}
    res = evaluate_dictation(req.target_text, req.user_text)
    return res

@app.post("/api/process-ai")
async def process_ai(file: UploadFile = File(...)):
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    sentences = generate_transcript_json(file_path) 
    transcript = " ".join(sentences)
    audio_b64 = get_audio_b64(file_path)

    if os.path.exists(file_path):
        os.remove(file_path)
        
    return {"transcript": transcript, "audio_b64": audio_b64, "status": "AI đã nhận diện xong kịch bản!"}

@app.post("/api/process-youtube")
async def process_youtube(req: YouTubeRequest):
    if not req.url:
        return {"error": "Vui lòng nhập link YouTube!"}
    
    temp_filename = "temp_yt_audio"
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': temp_filename,
        'quiet': True
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([req.url])
        
        actual_file = f"{temp_filename}.mp3"
        
        sentences = generate_transcript_json(actual_file)
        transcript = " ".join(sentences)
        audio_b64 = get_audio_b64(actual_file)
        
        if os.path.exists(actual_file):
            os.remove(actual_file)
            
        return {"transcript": transcript, "audio_b64": audio_b64, "status": "AI đã bóc tách xong từ YouTube!"}
    except Exception as e:
        return {"error": f"Lỗi tải YouTube: {str(e)}"}