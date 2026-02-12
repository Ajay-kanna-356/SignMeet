# SignMeet - Real-Time ISL Communication Platform

SignMeet is a powerful Google Meet extension designed to bridge the gap between sign language users and non-signers. It provides two-way communication:
1.  **Sign-to-Speech (Normal Mode)**: Recognizes sign language gestures via webcam and converts them to spoken text for the meeting.
2.  **Speech-to-Sign (Speech-Impaired Mode)**: Listens to meeting captions and animates a 3D avatar to sign the conversation in real-time.

---

## 🚀 Features

-   **Real-time Sign Detection**: Uses MediaPipe Holistic implementation for accurate hand/body tracking.
-   **3D Avatar**: High-quality 3D avatar that translates spoken words into Indian Sign Language (ISL) gestures.
-   **Text-to-Speech**: Automatically speaks recognized signs aloud to participants.
-   **Seamless Integration**: Operates directly within the Google Meet interface as an overlay.
-   **Privacy Focused**: Camera processing runs locally in a secure sandbox; only keypoints are sent to the backend.

---

## 🛠️ Installation Guide

The project consists of three parts:
1.  **Chrome Extension** (Frontend)
2.  **AI Service** (Python Backend for Sign Recognition)
3.  **API Server** (Node.js Proxy)

You need to run all three components for full functionality.

### 1. Prerequisite
-   Node.js (v16+)
-   Python (v3.10+)  *(Required for TensorFlow 2.19)*
-   Google Chrome

### 2. Setup AI Service (Python)
This service runs the TensorFlow model to predict signs from keypoints.

```bash
cd sign-speech/python-service
pip install -r requirements.txt
python app.py
```
> **Note:** Ensure the model file `best_model_60_frames.h5` exists in the `sign-speech` directory.
> The service runs on `http://localhost:5001`.

### 3. Setup API Server (Node.js)
This server acts as a bridge between the extension and the Python AI service.

```bash
cd sign-speech/node-server
npm install
node server.js
```
> The server runs on `http://localhost:3000`.

### 4. Setup Extension (Frontend)
Build and load the extension into Chrome.

```bash
# Go to root directory
cd ../.. 
npm install
npm run build
```

**Loading into Chrome:**
1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable **"Developer mode"** (top right toggle).
3.  Click **"Load unpacked"**.
4.  Select the `dist` folder generated in the project root.

---

## 🎮 Usage

1.  **Start the Backends**: Ensure `python app.py` (Port 5001) and `node server.js` (Port 3000) are running.
2.  **Open Google Meet**: Join any meeting.
3.  **Activate Extension**: You should see the SignMeet overlay in the bottom-left corner.
    -   **Sign-to-Speech (Normal Mode)**:
        -   Click "Normal Mode".
        -   Allow camera permissions when prompted.
        -   Perform signs (e.g., "Hello", "Thank You", "Good", "Alright").
        -   The detected word will appear on screen and be spoken aloud.
    -   **Speech-to-Sign (Speech-Impaired Mode)**:
        -   Click "Speech-Impaired Mode".
        -   Turn on **Captions** in Google Meet (cc button).
        -   As people speak, the avatar will translate the captions into signs.

---

## 📁 Project Structure

-   `/src`: React Extension source code.
    -   `/content`: Logic injected into Google Meet (Overlay, Capture).
    -   `/item`: Extensions popup UI.
    -   `/camera`: Sandboxed camera logic (MediaPipe).
-   `/public`: Static assets (3D models, manifest, icons).
-   `/sign-speech`: Backend services.
    -   `/python-service`: Flask app running TensorFlow model.
    -   `/node-server`: Express.js proxy server.

---

## 🔧 Troubleshooting

-   **Extension connection error**: Ensure both Python (5001) and Node (3000) servers are running.
-   **Camera not working**: 
    -   Ensure you allowed camera permissions for the extension iframe.
    -   If Google Meet is using the camera, try turning off your camera in Meet to allow the extension exclusive access (though concurrent access usually works).
-   **Avatar not moving**: Ensure Google Meet captions are enabled (cc button).

---

## 📜 License
ISC
