# Sign-Speech: Real-time Sign Language Recognition

This project implements a real-time sign language recognition system using a 3-tier architecture: a specialized Frontend (Client), a Node.js Middleware, and a Python AI Service.

## 📂 Project Structure

```
sign-speech/
├── node-server/            # Middleware Server (Node.js)
│   ├── server.js           # Express app handling API requests
│   └── package.json        # Node dependencies
├── python-service/         # AI Core Service (Flask + TensorFlow)
│   ├── app.py              # Flask app with model inference logic
│   └── requirements.txt    # Python dependencies
├── best_model_60_frames.h5 # Pre-trained Keras model
├── test.html               # Client-side testing interface
└── README.md               # This documentation
```

## 🏗 Architecture & Data Flow

1.  **Client (`test.html`)**:
    *   Captures webcam video.
    *   Uses **MediaPipe Holistic** (running in the browser) to extract skeletal landmarks (Keypoints) for both hands.
    *   Flattens these landmarks into a vector of **126 values** (2 hands * 21 landmarks * 3 coordinates).
    *   Sends these keypoints to the Node Server via HTTP POST.

2.  **Node Server (`server.js`)**:
    *   Acts as a proxy/middleware.
    *   Receives keypoints from the client.
    *   Forwards the data to the Python AI Service.
    *   Return predictions back to the client.

3.  **Python Service (`app.py`)**:
    *   Loads the Deep Learning model (`best_model_60_frames.h5`).
    *   Maintains a **Sliding Window Buffer** for each user session.
    *   Accumulates frames until it reaches **60 frames** (the model's expected sequence length).
    *   Runs inference and applies stability checks (thresholding) before returning a predicted word.

---

## 🚀 Setup & Usage

### 1. Python AI Service
**Location:** `sign-speech/python-service/`
This service hosts the TensorFlow model and performs the actual prediction.

**Prerequisites:** Python 3.8+

**Installation:**
```bash
cd python-service
# It is recommended to create a virtual environment first
pip install -r requirements.txt
```

**Running:**
```bash
python app.py
# Runs on http://localhost:5001
```

### 2. Node.js Server
**Location:** `sign-speech/node-server/`
This service handles API requests and CORS.

**Prerequisites:** Node.js

**Installation:**
```bash
cd node-server
npm install
```

**Running:**
```bash
node server.js
# Runs on http://localhost:3000
```

### 3. Client Interface
**File:** `sign-speech/test.html`
Simply open this file in any modern web browser.
- Allow Camera Access.
- You should see a skeletal overlay on your video feed.
- Perform signs. The detected word will appear in Green text when recognized.

---

## 📄 File-by-File Explanation

### 1. `test.html` (The Frontend)
This file is the entry point for the user. Its key responsibilities are:
-   **MediaPipe Integration**: Loads `holistic.js` from CDN to track face, pose, and hands. We specifically focus on **Left Hand** and **Right Hand** landmarks.
-   **Keypoint Extraction**: The function `extractKeypoints(results)` converts the complex MediaPipe results into a flat array of numbers.
    -   If a hand is not visible, it fills with arrays of zeros.
    -   Total input size sent is strictly **126 numbers**.
-   **Throttling**: Sends data every 100ms (10 FPS) to balance network load and real-time responsiveness.
-   **Visual Debugging**: Draws the skeletal tracking on a `<canvas>` element so the user knows they are being tracked.

### 2. `node-server/server.js` (The Proxy)
A lightweight Express.js server.
-   **POST `/process-sign`**: 
    -   Accepts JSON body: `{ userId: "...", keypoints: [...] }`.
    -   Validates data presence.
    -   Uses `axios` to pass this data to the Python Service (`http://127.0.0.1:5001/predict`).
    -   Returns the Python service's JSON response to the client.
-   **POST `/reset-sign`**:
    -   Endpoint to clear the server-side buffer (triggered by the 'Reset' button in the UI).

### 3. `python-service/app.py` (The Brain)
The core logic resides here using Flask and TensorFlow.
-   **Model Loading**: Loads `../best_model_60_frames.h5` at startup.
-   **Label Mapping**: Defines `ACTIONS` array mapping model output indices (0-10) to words (e.g., 'hello', 'thankyou').
-   **Session Management**: Uses a dictionary `user_sessions` to track independent frame buffers for different users (`userId`).
-   **Sliding Window Logic**:
    -   Appends incoming keypoints to a list.
    -   **Critical**: It waits for **60 frames** of history.
    -   If `len(history) >= 60`, it takes the *last* 60 frames, formats them as `(1, 60, 126)`, and predicts.
    -   **Stability Check**: To avoid flickering, it requires the model to predict the *same class* for 5 consecutive frames before showing the result.
    -   **Threshold**: Only accepts predictions with confidence > 0.85.

### 4. `best_model_60_frames.h5`
The binary Keras model file.
-   **Input Shape**: `(None, 60, 126)` -> Batch of sequences, 60 time steps, 126 features per step.
-   **Output**: Probability distribution over the defined classes.

---

## 🔧 Troubleshooting
-   **Buffer Stuck?**: If the buffer display in the UI keeps growing beyond 60 without prediction, ensure the Python service is running and checking for `>= 60` (not `== 60`).
-   **Latency**: If predictions are slow, check the `SEND_INTERVAL` in `test.html`. Currently set to 100ms. Lowering it (e.g., 50ms) increases FPS but adds network load.
-   **Model Input Mismatch**: Ensure `test.html` always sends 126 numbers. Even if a hand is missing, it sends zeros. The Python service validates this but doesn't crash; it just might ignore malformed frames.
