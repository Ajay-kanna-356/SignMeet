import os
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import subprocess
import tempfile
import time
import asyncio
import edge_tts
import pygame
from queue import Queue
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- 1. CONFIGURATION ---
MODEL_PATH = '../transformer/isl_transformer_best.keras'
TARGET_LENGTH = 20
CONFIDENCE_THRESHOLD = 0.99
SEND_GESTURE = "send"
SMOOTH_BUFFER = 5
CONFIRMATION_FRAMES = 7

CLASS_NAMES = [
    "alright", "cool", "finish", "good", "hello", "help", "job", "me", "meeting", "new",
    "no", "now", "problem", "secretary", "send", "sorry", "start", "team", "technology", "thank",
    "tomorrow", "wait", "we", "what", "yesterday", "you"
]

# --- POSITIONAL ENCODING ---
class PositionalEncoding(tf.keras.layers.Layer):
    def __init__(self, max_len, d_model, **kwargs):
        super(PositionalEncoding, self).__init__(**kwargs)
        self.max_len = max_len
        self.d_model = d_model
        pos = tf.cast(tf.range(max_len)[:, tf.newaxis], tf.float32)
        i = tf.cast(tf.range(d_model)[tf.newaxis, :], tf.float32)
        angle_rates = 1.0 / tf.pow(10000.0, (2.0 * tf.floor(i / 2.0)) / tf.cast(d_model, tf.float32))
        angle_rads = pos * angle_rates
        sines = tf.sin(angle_rads[:, 0::2])
        cosines = tf.cos(angle_rads[:, 1::2])
        pos_encoding = tf.concat([sines, cosines], axis=-1)
        self.pos_encoding = pos_encoding[tf.newaxis, ...]

    def call(self, x):
        return x + self.pos_encoding[:, :tf.shape(x)[1], :]

    def get_config(self):
        config = super().get_config()
        config.update({
            "max_len": self.max_len,
            "d_model": self.d_model
        })
        return config

# --- GROQ & TTS SETUP ---
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

LANGUAGE_MAP = {
    'en': 'English',
    'ta': 'Tamil',
    'hi': 'Hindi',
}

def gloss_to_sentence(gloss, lang_code='en'):
    language = LANGUAGE_MAP.get(lang_code, 'English')
    prompt = f"""
Convert this sign language gloss into a natural {language} sentence.
Return ONLY the sentence in {language}. Use only simple tenses and words.

Gloss: {gloss}

Sentence:
"""
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Groq API Error: {e}")
        return gloss

tts_queue = Queue()

# --- Windows TTS Voice Names (for English) ---
VOICE_MALE_NAME   = "Microsoft David Desktop"
VOICE_FEMALE_NAME = "Microsoft Zira Desktop"

# --- Edge TTS Neural Voice Map (for Tamil & Hindi) ---
# Format: (lang_code, gender) -> edge-tts voice name
EDGE_VOICE_MAP = {
    ('ta', 'MALE'):   'ta-IN-ValluvarNeural',
    ('ta', 'FEMALE'): 'ta-IN-PallaviNeural',
    ('hi', 'MALE'):   'hi-IN-MadhurNeural',
    ('hi', 'FEMALE'): 'hi-IN-SwaraNeural',
}

# Initialize pygame mixer once for audio playback
pygame.mixer.init()

async def speak_edge_tts(text: str, voice: str, tmp_path: str):
    """Save edge-tts audio to tmp_path asynchronously."""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(tmp_path)

def run_edge_tts(text: str, voice: str, tmp_path: str):
    """Run edge-tts in a fresh event loop (safe to call from any thread)."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(speak_edge_tts(text, voice, tmp_path))
    finally:
        loop.close()

def tts_worker():
    while True:
        task = tts_queue.get()
        if task is None:
            break
        text, voice_pref, lang_code = task
        try:
            print(f"[TTS] lang={lang_code}, voice={voice_pref}, text={text}")
            if lang_code == 'en':
                # English → Windows TTS (preserves David/Zira preference)
                voice_name = VOICE_FEMALE_NAME if voice_pref == "FEMALE" else VOICE_MALE_NAME
                ps_script = (
                    f'Add-Type -AssemblyName System.Speech; '
                    f'$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; '
                    f'$s.SelectVoice("{voice_name}"); '
                    f'$s.Rate = 1; '
                    f'$s.Speak("{text}");'
                )
                subprocess.run(["powershell", "-Command", ps_script], check=True)
            else:
                # Tamil / Hindi → edge-tts Neural Voices
                edge_voice = EDGE_VOICE_MAP.get((lang_code, voice_pref), EDGE_VOICE_MAP.get((lang_code, 'MALE')))
                print(f"[TTS] Using edge-tts voice: {edge_voice}")

                with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as f:
                    tmp_path = f.name

                # Use a fresh event loop — safe inside Flask's background thread
                run_edge_tts(text, edge_voice, tmp_path)
                print(f"[TTS] Audio saved ({os.path.getsize(tmp_path)} bytes), playing...")

                # Play using pygame
                pygame.mixer.music.load(tmp_path)
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy():
                    time.sleep(0.1)
                pygame.mixer.music.unload()
                os.unlink(tmp_path)
        except Exception as e:
            print(f"[TTS] Error: {e}")
        tts_queue.task_done()

threading.Thread(target=tts_worker, daemon=True).start()

def speak(text, voice_pref="MALE", lang_code="en"):
    tts_queue.put((text, voice_pref, lang_code))

# --- LOAD MODEL ---
print(f"Loading Model: {MODEL_PATH}...")
model = tf.keras.models.load_model(
    MODEL_PATH,
    custom_objects={"PositionalEncoding": PositionalEncoding}
)
print("Model Loaded.")

# --- WARMUP MODEL ---
print("Warming up model to prevent slow first-prediction deadlock...")
dummy_input = np.zeros((1, TARGET_LENGTH, 126), dtype=np.float32)
model(dummy_input, training=False)
print("Model warmed up successfully.")

# --- SESSION MANAGEMENT ---
user_sessions = {}
# Global lock to prevent deadlocks when multiple flask threads call model.predict simultaneously
prediction_lock = threading.Lock()

def process_sentence_thread(user_id, words_copy, voice_pref, lang_code):
    gloss = " ".join(words_copy)
    print("\nGloss:", gloss)
    sentence = gloss_to_sentence(gloss, lang_code)
    print("Sentence:", sentence)
    
    speak(sentence, voice_pref, lang_code)
    
    if user_id in user_sessions:
        user_sessions[user_id]["final_sentence"] = sentence
        # Leave processing true until we are completely done updating
        user_sessions[user_id]["processing"] = False

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    user_id = data.get('userId')
    keypoints = data.get('keypoints') 
    voice_pref = data.get('voicePref', 'MALE')
    lang_code = data.get('langPref', 'en')
    print(f"[PREDICT] voicePref='{voice_pref}' langPref='{lang_code}'")

    if not user_id or keypoints is None:
        return jsonify({"error": "Missing data"}), 400
        
    if len(keypoints) != 126:
        pass

    if user_id not in user_sessions:
        user_sessions[user_id] = {
            "sequence": [],
            "prediction_buffer": [],
            "collected_words": [],
            "candidate_word": None,
            "candidate_count": 0,
            "last_confirmed_word": None,
            "processing": False,
            "final_sentence": ""
        }
    
    session = user_sessions[user_id]
    session["sequence"].append(keypoints)

    if len(session["sequence"]) > TARGET_LENGTH:
        session["sequence"].pop(0)

    prediction_text = ""
    confidence = 0.0
    
    if len(session["sequence"]) == TARGET_LENGTH:
        input_data = np.expand_dims(session["sequence"], axis=0) # Shape: (1, 20, 126)
        
        # Thread-safe prediction execution
        with prediction_lock:
            prediction = model(input_data, training=False).numpy()
            
        class_index = np.argmax(prediction)
        confidence = float(prediction[0][class_index])
        raw_prediction = CLASS_NAMES[class_index]
        
        # Smoothing
        session["prediction_buffer"].append(raw_prediction)
        if len(session["prediction_buffer"]) > SMOOTH_BUFFER:
            session["prediction_buffer"].pop(0)
            
        prediction_text = max(set(session["prediction_buffer"]), key=session["prediction_buffer"].count)
        
        # Command / Send Gesture handling
        if prediction_text.lower() == SEND_GESTURE and confidence > 0.85:
            if session["collected_words"] and not session["processing"]:
                session["processing"] = True
                
                # Start processing thread
                threading.Thread(
                    target=process_sentence_thread,
                    args=(user_id, session["collected_words"].copy(), voice_pref, lang_code),
                    daemon=True
                ).start()
                
                session["final_sentence"] = "Processing..."
                session["sequence"].clear()
                session["prediction_buffer"].clear()
                session["candidate_word"] = None
                session["candidate_count"] = 0
                session["last_confirmed_word"] = None
                session["collected_words"].clear()
                
        # Confirmation logic for collecting words
        elif confidence >= CONFIDENCE_THRESHOLD:
            if prediction_text == session["candidate_word"]:
                session["candidate_count"] += 1
            else:
                session["candidate_word"] = prediction_text
                session["candidate_count"] = 1
                
            if session["candidate_count"] >= CONFIRMATION_FRAMES:
                if session["last_confirmed_word"] != session["candidate_word"]:
                    session["collected_words"].append(session["candidate_word"])
                    session["last_confirmed_word"] = session["candidate_word"]
                    
                    # Log internally
                    print(f"Stored: {session['candidate_word']}")
                    
                    # Reset buffers to prevent re-triggering the same word quickly
                    session["sequence"].clear()
                    session["prediction_buffer"].clear()
                    
                session["candidate_count"] = 0

    return jsonify({
        "current_prediction": f"{prediction_text} ({confidence:.2f})" if prediction_text else "",
        "words": "Words: " + " ".join(session["collected_words"]),
        "sentence": "Sentence: " + session["final_sentence"]
    })

@app.route('/reset', methods=['POST'])
def reset():
    data = request.json
    user_id = data.get('userId')
    if user_id in user_sessions:
        session = user_sessions[user_id]
        session["sequence"].clear()
        session["prediction_buffer"].clear()
        session["collected_words"].clear()
        session["candidate_word"] = None
        session["candidate_count"] = 0
        session["last_confirmed_word"] = None
        session["processing"] = False
        session["final_sentence"] = ""
    return jsonify({"status": "cleared"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
