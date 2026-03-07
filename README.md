# SignMeet - Real-Time ISL Communication Platform

SignMeet is a powerful Google Meet extension designed to bridge the gap between sign language users and non-signers. It provides two-way communication directly within your browser:

1. **Sign-to-Speech (Speaking Mode)**: Recognizes Indian Sign Language (ISL) gestures via webcam in real-time, converts them to sentences using the Groq API (LLaMA 3.3), and speaks the text aloud using Text-to-Speech to the meeting participants.
2. **Speech-to-Sign (Listening Mode)**: Actively listens to meeting captions from Google Meet and animates a high-quality 3D avatar to sign the conversation in real-time.

---

## 🚀 Key Features

- **Real-Time Sign Recognition**: Uses MediaPipe Holistic for accurate hand tracking and a custom Keras Transformer model to recognize sequences of ISL glosses.
- **LLM-Powered Sentence Generation**: Converts isolated signed glosses into natural English sentences using the ultra-fast Groq API.
- **3D Avatar Translation**: Dynamically loads and blends `.glb` animations to translate spoken English into ISL signs for deaf/hard-of-hearing users.
- **Seamless Meet Integration**: Operates directly within the Google Meet interface as a non-intrusive UI overlay.
- **Privacy Focused**: MediaPipe camera inference runs safely sandboxed within the browser extension; only anonymized lightweight coordinate arrays (keypoints) are sent to the local AI backend.

---

## 🏗️ Architecture & Data Flow

Our platform is powered by a 3-tier architecture:

1. **Client (Chrome Extension `/src`)**:
   * Uses **MediaPipe Holistic** in the browser to extract 3D skeletal hand landmarks.
   * Flattens these landmarks into an array of **126 values** (2 hands × 21 landmarks × 3 coordinates `x,y,z`).
   * Sends the live keypoints stream to the Node middleware.

2. **Middleware (Node.js Server `/sign-speech/node-server`)**:
   * Acts as a fast JSON proxy to route traffic between the extension sandbox and the Python Deep Learning core.

3. **AI Core (Python Flask `/sign-speech/python-service`)**:
   * Loads a trained **Transformer model** (`isl_transformer_best.keras`).
   * Maintains a sliding window buffer of **20 frames** per user session.
   * Performs real-time inference and stability thresholding.
   * On the "send" gesture, gathers collected words, queries the **Groq API** to build a context-aware sentence, and uses local TTS to speak the result.

---

## 🛠️ Installation & Setup

You need to run all three components (AI Service, Proxy, and Extension) locally. 

### Prerequisites
- Node.js (v16+)
- Python 3.10+
- A [Groq API Key](https://console.groq.com/)

### 1. Setup AI Service (Python Backend)
This service runs the TensorFlow Transformer model.

```bash
cd sign-speech/python-service
pip install -r requirements.txt
```
*Create a `.env` file inside `sign-speech/python-service` and add your API key:*
```env
GROQ_API_KEY=your_groq_key_here
```
Run the server:
```bash
python app.py
```
> Runs on `http://localhost:5001`.

### 2. Setup API Proxy Server (Node.js Middleware)
This server handles CORS and bridges the browser to Python.

```bash
cd sign-speech/node-server
npm install
node server.js
```
> Runs on `http://localhost:3000`.

### 3. Setup the Chrome Extension (Frontend)
Build the React/Vite extension and load it into your browser.

```bash
# From the project root
npm install
npm run build
```
**Loading into Chrome:**
1. Navigate to `chrome://extensions`.
2. Enable **"Developer mode"** (top right).
3. Click **"Load unpacked"** and select the `/dist` folder inside the project root.

---

## 🎮 How to Use

1. **Start Backends**: Ensure `python app.py` and `node server.js` are running.
2. **Open Google Meet**: Start or join a meeting.
3. **Use the Extension**: Click on the SignMeet overlay widget in the bottom-left corner.

   - **Sign-to-Speech (Normal Mode)**: Select this mode and allow camera access. Perform ISL signs. The system will detect words (e.g., "Hello", "Thank you"). To construct the sentence and trigger the audio speaking, perform the **"send"** gesture.
   - **Speech-to-Sign (Speech-Impaired Mode)**: Select this mode and turn on Google Meet **Captions (CC)**. Whenever participants speak, the 3D avatar will translate the recognized transcript into signs!

---

## 📁 Project Structure

```text
SignMeet/
├── dist/                          # Compiled Chrome extension (load this!)
├── public/assets/                 # 3D .glb avatar animations & MediaPipe dependencies
├── src/                           # React extension source code
│   ├── camera/                    # Sandboxed client-side camera + MediaPipe logic
│   ├── content/                   # UI injected into Google Meet
│   └── speech-sign/               # 3D Avatar Three.js rendering logic
└── sign-speech/                   # Backend folder
    ├── node-server/               # Express.js intermediary API
    ├── python-service/            # Flask + TensorFlow AI inference engine
    └── transformer/               # Keras models and datasets
```

---


