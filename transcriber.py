import warnings
import whisper
import sys
import os
import torch
from pydub import AudioSegment  
from threading import Lock
warnings.filterwarnings("ignore", category=FutureWarning)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

model_name = "base"
model = whisper.load_model(model_name, device=device)

lock = Lock()

def convert_mp3_to_wav(mp3_path, wav_path):
    """Convert mp3 file to wav format using pydub."""
    try:
        audio = AudioSegment.from_mp3(mp3_path)
        audio.export(wav_path, format="wav")
        print(f"Converted {mp3_path} to {wav_path}")
        return wav_path
    except Exception as e:
        print(f"Error converting {mp3_path} to wav: {e}")
        return None

def split_channels(audio_path):
    """Split stereo audio into left and right channels using pydub."""
    try:
        audio = AudioSegment.from_file(audio_path) 
        if audio.channels != 2:
            raise ValueError("Audio is not stereo. It must have two channels (left and right).")
        
        left_channel = audio.split_to_mono()[0]
        right_channel = audio.split_to_mono()[1]
        
        left_audio_path = "left_channel.wav"
        right_audio_path = "right_channel.wav"
        left_channel.export(left_audio_path, format="wav")
        right_channel.export(right_audio_path, format="wav")
        
        return left_audio_path, right_audio_path
    except Exception as e:
        print(f"Error splitting channels for {audio_path}: {e}")
        return None, None

def transcribe(audio_path):
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"File not found: {audio_path}")

    wav_path = audio_path.replace(".mp3", ".wav")
    if audio_path.endswith(".mp3") and not os.path.exists(wav_path):
        wav_path = convert_mp3_to_wav(audio_path, wav_path)
        if not wav_path:
            return None 

    print(f"Transcribing: {wav_path}...")

    try:
        left_audio_path, right_audio_path = split_channels(wav_path)
        if not left_audio_path or not right_audio_path:
            return None

        with lock:
            print("Transcribing left channel (Agent)...")
            left_result = model.transcribe(left_audio_path, fp16=torch.cuda.is_available())
            left_transcription = left_result['text']
            
            print("Transcribing right channel (Customer)...")
            right_result = model.transcribe(right_audio_path, fp16=torch.cuda.is_available())
            right_transcription = right_result['text']

        transcription = f"Agent (Left): {left_transcription}\nCustomer (Right): {right_transcription}"
        
        os.remove(left_audio_path)
        os.remove(right_audio_path)

        return transcription

    except Exception as e:
        print(f"Error transcribing {wav_path}: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Please provide at least one audio file path.")
        sys.exit(1)

    for audio_path in sys.argv[1:]:
        transcription = transcribe(audio_path)
        if transcription is not None:
            print(f"Transcription for {audio_path}:\n{transcription}")
