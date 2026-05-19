import os, json, base64, shutil, yt_dlp, re
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import List, Optional
from fastapi.security import OAuth2PasswordRequestForm

import models, auth
from dictation import evaluate_dictation
from engine import generate_transcript_json
from moviepy.video.io.VideoFileClip import VideoFileClip

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, "hanlingua.db")

engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR, FRONTEND_DIR = os.path.join(ROOT_DIR, "data"), os.path.join(ROOT_DIR, "frontend")

class UserCreate(BaseModel): username: str; password: str
class EvalRequest(BaseModel): target_text: str; user_text: str; lesson_id: Optional[int] = None
class ClozeEvalRequest(BaseModel): cloze_answers: list; level: int; lesson_id: int
class LessonCreate(BaseModel): title: str; level: int; audio_url: str; transcript: str; translation: str

class LessonSchema(BaseModel):
    id: int
    title: str
    level: int
    class Config: from_attributes = True

@app.post("/api/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(username=user.username).first():
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại")
    new_user = models.User(username=user.username, hashed_password=auth.get_password_hash(user.password), role="user")
    db.add(new_user); db.commit()
    return {"msg": "Đăng ký thành công!"}

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(username=form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Sai tài khoản/mật khẩu")
    return {"access_token": auth.create_access_token({"sub": user.username}), "token_type": "bearer", "role": user.role}

@app.get("/api/auth/me")
def read_me(current_user: models.User = Depends(auth.get_current_user)):
    return {"username": current_user.username, "role": current_user.role}

@app.get("/api/lessons/list", response_model=List[LessonSchema])
def get_all_lessons(db: Session = Depends(get_db)):
    return db.query(models.Lesson).all()

@app.get("/api/lessons/{lesson_id}")
def get_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.query(models.Lesson).filter_by(id=lesson_id).first()
    if not lesson: raise HTTPException(status_code=404, detail="Không tìm thấy bài")
    return {
        "id": lesson.id, "title": lesson.title, "level": lesson.level,
        "transcript": lesson.transcript, "translation": lesson.translation,
        "cloze_data": json.loads(lesson.cloze_data_json) if lesson.cloze_data_json else [],
        "audio_src": lesson.audio_url
    }

@app.post("/api/evaluate")
def evaluate(req: EvalRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    res = evaluate_dictation(req.target_text, req.user_text)
    if req.lesson_id:
        db.add(models.UserProgress(user_id=current_user.id, lesson_id=req.lesson_id, score=res["score_percent"]))
        db.commit()
    return res

@app.post("/api/evaluate-cloze")
def evaluate_cloze(req: ClozeEvalRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    lesson = db.query(models.Lesson).filter_by(id=req.lesson_id).first()
    correct_answers = []
    for row in json.loads(lesson.cloze_data_json):
        for item in row:
            if item["is_blank"]: correct_answers.append(re.sub(r'[.,!?~]+', '', item["word"]))
    score, feedback = 0, []
    for i, correct in enumerate(correct_answers):
        u_ans = req.cloze_answers[i].strip() if i < len(req.cloze_answers) else ""
        is_match = u_ans.lower() == correct.lower()
        if is_match: score += 1
        feedback.append({"word": u_ans or "___", "correct": correct, "status": "correct" if is_match else "wrong"})
    perc = int((score / len(correct_answers))*100) if correct_answers else 0
    db.add(models.UserProgress(user_id=current_user.id, lesson_id=req.lesson_id, score=perc))
    db.commit()
    return {"score_percent": perc, "feedback": feedback, "is_cloze": True}

@app.post("/api/process-ai")
async def process_ai(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
    transcript = generate_transcript_json(temp_path)
    with open(temp_path, "rb") as f: audio_b64 = base64.b64encode(f.read()).decode()
    os.remove(temp_path)
    return {"transcript": " ".join(transcript), "audio_b64": audio_b64}

@app.post("/api/process-youtube")
async def process_youtube(data: dict):
    url = data.get("url")
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'temp_yt', 
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'm4a', 
        }],
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl: 
        ydl.download([url])

    transcript = generate_transcript_json("temp_yt.m4a")
    with open("temp_yt.m4a", "rb") as f: audio_b64 = base64.b64encode(f.read()).decode()
    os.remove("temp_yt.m4a")
    return {"transcript": " ".join(transcript), "audio_b64": audio_b64}

@app.post("/api/admin/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    file_path = os.path.join(DATA_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/data/{file.filename}"}

@app.post("/api/admin/lessons")
def create_lesson(req: LessonCreate, db: Session = Depends(get_db)):
    new_lesson = models.Lesson(
        title=req.title, 
        level=req.level, 
        audio_url=req.audio_url,
        transcript=req.transcript, 
        translation=req.translation,
        cloze_data_json="[]" 
    )
    db.add(new_lesson)
    db.commit()
    return {"msg": "Thành công"}

@app.delete("/api/admin/lessons/{lesson_id}")
def delete_lesson(lesson_id: int, db: Session = Depends(get_db)):
    db.query(models.UserProgress).filter_by(lesson_id=lesson_id).delete()
    db.query(models.Lesson).filter_by(id=lesson_id).delete()
    db.commit(); return {"msg": "Đã xóa"}

app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")