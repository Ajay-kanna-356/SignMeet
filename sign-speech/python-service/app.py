from flask import Flask, request, jsonify
from flask_cors import CORS
# import cv2 # Not needed
# import mediapipe as mp # Not needed
import numpy as np
import tensorflow as tf
# import base64 # Not needed
import os

app = Flask(__name__)
CORS(app) 

# --- 1. CONFIGURATION (MATCHING YOUR NOTEBOOK) ---
MODEL_PATH = '../best_model_60_frames.h5'  # Pointing to the model from code.ipynb
TARGET_LENGTH = 60                   # Notebook used 90 frames, so we must use 90
THRESHOLD = 0.85

# --- 2. EXACT LABEL MAPPING FROM NOTEBOOK ---
# The model outputs probabilities for 0-10. We must map them back to words.
# Order found in code.ipynb output: {'alright': 0, 'cool': 1, 'good': 2, ...}
ACTIONS = np.array([
    'alright',      # 0
    'cool',         # 1
    'good',         # 2
    'hello',        # 3
    'job',          # 4
    'new',          # 5
    'secretary',    # 6
    'sorry',        # 7
    'Team',         # 8
    'Technology',   # 9
    'thankyou'      # 10
])

# --- 3. LOAD MODEL ---
print(f"Loading Model: {MODEL_PATH}...")
model = tf.keras.models.load_model(MODEL_PATH)
print("Model Loaded.")

# --- 4. SESSION MANAGEMENT ---
user_sessions = {}

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    user_id = data.get('userId')
    keypoints = data.get('keypoints') 

    if not user_id or keypoints is None:
        return jsonify({"error": "Missing data"}), 400
        
    # Validation: Ensure 126 keypoints (21*3 LH + 21*3 RH)
    if len(keypoints) != 126:
        # If client sends 0s or empty, it might be fine, but model expects 126.
        # Just in case client implementation varies, let's just log and zero pad if needed or fail.
        # But for now assume client is correct.
        pass

    # Initialize session
    if user_id not in user_sessions:
        user_sessions[user_id] = {
            "sequence": [],
            "predictions": [] 
        }
    
    session = user_sessions[user_id]

    # 1. Add to Buffer
    session["sequence"].append(keypoints)

    response_word = None
    
    # 2. Prediction Logic (Sliding Window)
    if len(session["sequence"]) >= TARGET_LENGTH:
        # Take the LAST 60 frames for prediction
        window = session["sequence"][-TARGET_LENGTH:]

        # Predict
        input_data = np.expand_dims(window, axis=0) # Shape: (1, 60, 126)
        res = model.predict(input_data)[0]
        best_guess_index = np.argmax(res)
        confidence = res[best_guess_index]
        
        # Stability Check
        session["predictions"].append(best_guess_index)
        if len(session["predictions"]) > 5:
            session["predictions"] = session["predictions"][-5:]
            
        is_stable = np.all(np.array(session["predictions"]) == best_guess_index)
        
        if is_stable and confidence > THRESHOLD:
            raw_word = ACTIONS[best_guess_index]
            response_word = raw_word
            
            # Flush buffer
            session["sequence"] = [] 
            session["predictions"] = []
        else:
            # Slide window: Keep the last 59 frames so appending next one makes 60
            session["sequence"] = session["sequence"][-(TARGET_LENGTH-1):]

    return jsonify({
        "word": response_word,
        "buffer_length": len(session["sequence"])
    })

@app.route('/reset', methods=['POST'])
def reset():
    data = request.json
    user_id = data.get('userId')
    if user_id in user_sessions:
        user_sessions[user_id]["sequence"] = []
        user_sessions[user_id]["predictions"] = []
    return jsonify({"status": "cleared"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
