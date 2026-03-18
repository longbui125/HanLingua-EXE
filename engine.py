import torch
import json
import re
import os
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

model_id = "ylacombe/whisper-large-v3-turbo"
device = "cuda" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id, torch_dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True
)
model.to(device)
processor = AutoProcessor.from_pretrained(model_id)

pipe = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    device=device,
    chunk_length_s=30
)

def generate_transcript_json(file_path):
    result = pipe(file_path, return_timestamps=True, generate_kwargs={"language": "korean"})
    text = result["text"].strip()

    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]