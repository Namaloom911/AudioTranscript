import warnings
import whisper
import sys
import os
import torch
import torchaudio
from threading import Lock
warnings.filterwarnings("ignore", category=FutureWarning)


def get_audio_duration(audio_path):
    info = torchaudio.info(audio_path)
    duration = info.num_frames / info.sample_rate
    return duration


device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

model_name = "tiny"  
model = whisper.load_model(model_name, device=device)

lock = Lock()

def transcribe(audio_path):
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"File not found: {audio_path}")

    print(f"Transcribing: {audio_path}...")

    try:
        with lock:
            result = model.transcribe(audio_path, fp16=torch.cuda.is_available())  # Set fp16 only if CUDA is available
            transcription = result['text']

        transcription = transcription.encode('utf-8', 'replace').decode('utf-8')

        return transcription

    except Exception as e:
        print(f"Error transcribing {audio_path}: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Please provide at least one audio file path.")
        sys.exit(1)

    for audio_path in sys.argv[1:]:
        transcription = transcribe(audio_path)
        if transcription is not None:
            print(f"Transcription for {audio_path}: {transcription}")
