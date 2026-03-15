import base64
import os
import json
import shutil
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, FileResponse

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

def get_audio_b64(file_path):
    if not os.path.exists(file_path): return ""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode()

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/audio.mp3")
async def serve_audio():
    if os.path.exists("audio.mp3"):
        return FileResponse("audio.mp3")
    return {"error": "Không tìm thấy file!"}

@app.get("/api/default-data")
async def get_default_data():
    transcript = ""
    audio_b64 = ""
    status = "Thiếu dữ liệu bài học mặc định."
    
    if os.path.exists('trans.json'):
        with open('trans.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        transcript = " ".join(data) 
    
    if os.path.exists('audio.mp3'):
        audio_b64 = get_audio_b64("audio.mp3")
        status = "Đã tải bài học mặc định."
        
    return {"transcript": transcript, "audio_b64": audio_b64, "status": status}

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