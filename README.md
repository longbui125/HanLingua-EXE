# Project Setup

## Requirements

Install the required Python libraries:

```bash
pip install fastapi uvicorn python-multipart transformers torch torchaudio librosa
```

Additionally, make sure **FFmpeg** is installed on your system.

### Install FFmpeg

**Windows**

1. Download FFmpeg from: https://ffmpeg.org/download.html
2. Extract the file.
3. Add the `bin` folder to your system **PATH**.

**MacOS**

```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian)**

```bash
sudo apt update
sudo apt install ffmpeg
```

---

## Run the Application

Start the FastAPI server using:

```bash
uvicorn app:app --reload
```

After running the command, open your browser and access:

```
http://127.0.0.1:8000
```

