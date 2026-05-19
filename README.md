## Installation and Setup

**Step 1: Install dependencies**
```bash
pip install -r requirement.txt
```

**Step 2: Initialize the database**
Run the database initialization script:
```bash
python backend/init_db.py
```
*(Note: If your application is configured to automatically run `init_db` upon FastAPI startup, you can skip this step).*

**Step 3: Start the backend server**
Run Uvicorn and point it directly to the `backend` directory:
```bash
uvicorn main:app --reload --app-dir backend
```
