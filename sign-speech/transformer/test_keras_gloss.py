import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
import os
import threading
import pyttsx3
import time
from queue import Queue
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

from time import time
# ============================
# GROQ SETUP
# ============================
import mediapipe as mp

mp_drawing = mp.solutions.drawing_utils
mp_hands = mp.solutions.hands

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def gloss_to_sentence(gloss):

    prompt = f"""
Convert this sign language gloss into a natural English sentence.
Return ONLY the sentence.use only tenses and fillers extra simple.

Gloss: {gloss}

Sentence:
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    return response.choices[0].message.content.strip()


# ============================
# CONFIGURATION
# ============================

WINDOW_SIZE = 20
CONFIDENCE_THRESHOLD = 0.99
SEND_GESTURE = "send"

SMOOTH_BUFFER = 5
CONFIRMATION_FRAMES = 7




# ============================ 
# TTS ENGINE (FULLY FIXED)
# ============================
tts_queue = Queue()

def tts_worker():
    import pythoncom
    pythoncom.CoInitialize()  # Required for Windows COM threads

    while True:
        text = tts_queue.get()
        if text is None:
            break
        try:
            # Re-initialize the engine for each sentence to avoid thread locking
            # which causes audio to only work the first time in pyttsx3
            engine = pyttsx3.init()
            engine.setProperty('rate', 160)
            engine.say(text)
            engine.runAndWait()
            del engine
        except Exception as e:
            print(f"TTS error: {e}")
        tts_queue.task_done()


threading.Thread(target=tts_worker, daemon=True).start()

def speak(text):
    tts_queue.put(text)



# ============================
# POSITIONAL ENCODING
# ============================

class PositionalEncoding(tf.keras.layers.Layer):
    def __init__(self, max_len, d_model, **kwargs):
        super(PositionalEncoding, self).__init__(**kwargs)

        self.max_len = max_len
        self.d_model = d_model

        pos = tf.cast(tf.range(max_len)[:, tf.newaxis], tf.float32)
        i = tf.cast(tf.range(d_model)[tf.newaxis, :], tf.float32)

        angle_rates = 1.0 / tf.pow(
            10000.0,
            (2.0 * tf.floor(i / 2.0)) / tf.cast(d_model, tf.float32)
        )

        angle_rads = pos * angle_rates

        sines = tf.sin(angle_rads[:, 0::2])
        cosines = tf.cos(angle_rads[:, 1::2])

        pos_encoding = tf.concat([sines, cosines], axis=-1)

        self.pos_encoding = pos_encoding[tf.newaxis, ...]

    def call(self, x):

        return x + self.pos_encoding[:, :tf.shape(x)[1], :]


    # IMPORTANT: Needed for serialization
    def get_config(self):

        config = super().get_config()

        config.update({
            "max_len": self.max_len,
            "d_model": self.d_model
        })

        return config

# ============================
# LOAD MODEL
# ============================

model = tf.keras.models.load_model(
    r"D:\transformer\isl_transformer_best.keras",
    custom_objects={"PositionalEncoding": PositionalEncoding}
)

print("Model loaded successfully")


# ============================
# LOAD CLASS NAMES
# ============================

CLASS_NAMES = sorted(os.listdir("D:/npy Dataset"))

print("Classes:", CLASS_NAMES)


# ============================
# MEDIAPIPE INIT
# ============================

base_options = python.BaseOptions(
    model_asset_path="hand_landmarker.task"
)

options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=2
)

detector = vision.HandLandmarker.create_from_options(options)


# ============================
# FEATURE EXTRACTION
# ============================

def extract_features(frame, draw=True):

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    )

    result = detector.detect(mp_image)

    features = np.zeros(126, dtype=np.float32)

    if result.hand_landmarks:

        h, w, _ = frame.shape

        for hand_index, hand_landmarks in enumerate(result.hand_landmarks):

            if hand_index >= 2:
                break

            for i, lm in enumerate(hand_landmarks):

                idx = hand_index * 63 + i * 3

                features[idx] = lm.x
                features[idx+1] = lm.y
                features[idx+2] = lm.z

        if draw:

            connections = mp.solutions.hands.HAND_CONNECTIONS

            # draw landmarks
            for lm in hand_landmarks:
                cx = int(lm.x * w)
                cy = int(lm.y * h)
                cv2.circle(frame, (cx, cy), 4, (0,255,0), -1)

            # draw connections
            for connection in connections:
                start_idx = connection[0]
                end_idx = connection[1]

                x1 = int(hand_landmarks[start_idx].x * w)
                y1 = int(hand_landmarks[start_idx].y * h)

                x2 = int(hand_landmarks[end_idx].x * w)
                y2 = int(hand_landmarks[end_idx].y * h)

                cv2.line(frame, (x1,y1), (x2,y2), (255,255,255), 2)

    return features


# ============================
# STATE VARIABLES
# ============================

sequence = []
prediction_buffer = []

collected_words = []

processing = False
final_sentence = ""

# confirmation logic
candidate_word = None
candidate_count = 0
last_confirmed_word = None


# ============================
# SENTENCE THREAD
# ============================

def process_sentence(words):

    global final_sentence, processing, collected_words

    gloss = " ".join(words)

    print("\nGloss:", gloss)

    sentence = gloss_to_sentence(gloss)

    print("Sentence:", sentence)

    final_sentence = sentence

    speak(sentence)

    collected_words.clear()

    processing = False


# ============================
# START CAMERA
# ============================

cap = cv2.VideoCapture(0)

print("\nSystem started")


while True:

    ret, frame = cap.read()

    if not ret:
        break

    features = extract_features(frame)

    sequence.append(features)

    if len(sequence) > WINDOW_SIZE:
        sequence.pop(0)

    if len(sequence) == WINDOW_SIZE:

        input_data = np.expand_dims(sequence, axis=0)

        prediction = model.predict(input_data, verbose=0)

        class_index = np.argmax(prediction)

        confidence = float(prediction[0][class_index])

        raw_prediction = CLASS_NAMES[class_index]

        # smoothing
        prediction_buffer.append(raw_prediction)

        if len(prediction_buffer) > SMOOTH_BUFFER:
            prediction_buffer.pop(0)

        prediction_text = max(
            set(prediction_buffer),
            key=prediction_buffer.count
        )


        # ============================
        # SEND GESTURE
        # ============================

        if prediction_text.lower() == SEND_GESTURE and confidence > 0.85:

            if collected_words and not processing:

                processing = True

                final_sentence = "Processing..."

                sequence.clear()
                prediction_buffer.clear()

                candidate_word = None
                candidate_count = 0
                last_confirmed_word = None

                threading.Thread(
                    target=process_sentence,
                    args=(collected_words.copy(),),
                    daemon=True
                ).start()


        # ============================
        # CONFIRMATION LOGIC
        # ============================

        elif confidence >= CONFIDENCE_THRESHOLD :
            print(prediction_text,confidence)
            if prediction_text == candidate_word:

                candidate_count += 1

            else:

                candidate_word = prediction_text
                candidate_count = 1


            if candidate_count >= CONFIRMATION_FRAMES:

                if last_confirmed_word != candidate_word:

                    collected_words.append(candidate_word)

                    print("Stored:", candidate_word)

                    last_confirmed_word = candidate_word

                    sequence.clear()
                    prediction_buffer.clear()

                candidate_count = 0


        cv2.putText(
            frame,
            f"{prediction_text} ({confidence:.2f})",
            (10,40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0,255,0),
            2
        )


    cv2.putText(
        frame,
        "Words: " + " ".join(collected_words),
        (10,80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0,255,255),
        2
    )


    cv2.putText(
        frame,
        "Sentence: " + final_sentence,
        (10,120),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255,255,0),
        2
    )


    cv2.imshow("ISL Transformer + Groq + TTS", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break


cap.release()
cv2.destroyAllWindows()