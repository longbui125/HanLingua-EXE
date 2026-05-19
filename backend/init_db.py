import json, os, re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models, auth

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, "hanlingua.db")

engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
models.Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

print("--- ĐANG KHỞI TẠO HỆ THỐNG HANLINGUA ---")

if not db.query(models.User).filter_by(username="admin").first():
    db.add(models.User(username="admin", hashed_password=auth.get_password_hash("123456"), role="admin"))
    print(" [+] Tạo thành công Admin (admin / 123456)")

if not db.query(models.User).filter_by(username="user").first():
    db.add(models.User(username="user", hashed_password=auth.get_password_hash("123456"), role="user"))
    print(" [+] Tạo thành công User thường (user / 123456)")

if not db.query(models.Lesson).first():
    def load_json(filename):
        path = os.path.join(DATA_DIR, filename)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f: return json.load(f)
        return []

    t1, tv1 = load_json("trans.json"), load_json("trans_vi.json")
    cloze_1 = []
    for sentence in t1:
        words = sentence.split()
        struct = [{"word": w, "is_blank": (len(re.sub(r'[.,!?~]+', '', w)) > 1 and (i+1)%3==0)} for i, w in enumerate(words)]
        cloze_1.append(struct)
    
    db.add(models.Lesson(title="Bài 1: Sở thích", level=1, audio_url="/data/audio.mp3", transcript=" ".join(t1), translation=" ".join(tv1), cloze_data_json=json.dumps(cloze_1, ensure_ascii=False)))

    t2, tv2 = load_json("trans_2.json"), load_json("trans_vi_2.json")
    db.add(models.Lesson(title="Bài 2: Thời tiết", level=2, audio_url="/data/audio_2.mp3", transcript=" ".join(t2), translation=" ".join(tv2), cloze_data_json="[]"))
    print(" [+] Đổ thành công 2 bài học mẫu vào Database")

db.commit()
db.close()
print("--- HOÀN TẤT! HỆ THỐNG ĐÃ SẴN SÀNG ---")