import { Holistic, Results, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

console.log("[SIGNMEET] Camera Page Loaded");

export class CameraController {
    private holistic: Holistic;
    private canvas: HTMLCanvasElement;
    private videoElement: HTMLVideoElement;
    private ctx: CanvasRenderingContext2D;
    private isProcessing = false;
    private lastSent = 0;
    private isSending = false;
    private readonly SEND_INTERVAL = 33; // ~30 FPS (1000ms / 30)
    private readonly USER_ID = "extension_user_" + Math.floor(Math.random() * 1000);
    private animationFrameId: number | null = null;
    private debugText: HTMLDivElement;
    private stream: MediaStream | null = null;
    private voicePref: string = 'MALE'; // default until told otherwise

    constructor() {
        this.videoElement = document.getElementById('input_video') as HTMLVideoElement;
        this.canvas = document.getElementById('output_canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.debugText = document.getElementById('debug_text') as HTMLDivElement;

        console.log("[SIGNMEET] Initializing MediaPipe (Iframe Context)...");

        // In this context (extension page), relative paths work perfectly!
        this.holistic = new Holistic({
            locateFile: (file) => {
                // We are at root/camera.html, assets are in assets/mediapipe/
                // Chrome handles relative path resolution automatically for us here.
                // Or absolute path from root: /assets/mediapipe/${file}
                return `/assets/mediapipe/${file}`;
            }
        });

        this.holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.holistic.onResults(this.onResults.bind(this));

        // Listen for voicePref updates sent from the parent page (Overlay.tsx)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'VOICE_PREF') {
                this.voicePref = event.data.pref;
                console.log('[SIGNMEET] Voice pref updated to:', this.voicePref);
            }
        });
    }

    public async start() {
        try {
            console.log("[SIGNMEET] Requesting User Media...");
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, frameRate: { ideal: 30 } },
                audio: false
            });

            this.videoElement.srcObject = this.stream;

            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve(null);
                };
            });

            console.log("[SIGNMEET] Camera Started in Iframe.");
            this.debugText.innerText = "Active";
            this.isProcessing = true;
            this.processFrame();

        } catch (err) {
            console.error("[SIGNMEET] Camera Access Error:", err);
            this.debugText.innerText = "Camera Denied";
            this.debugText.style.color = "red";
        }
    }

    private async processFrame() {
        if (!this.isProcessing) return;
        if (this.videoElement.readyState >= 2) {
            try {
                await this.holistic.send({ image: this.videoElement });
            } catch (e) {
                // errors
            }
        }
        this.animationFrameId = requestAnimationFrame(() => this.processFrame());
    }

    private onResults(results: Results) {
        // Draw
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

        if (results.leftHandLandmarks) {
            drawConnectors(this.ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: '#CC0000', lineWidth: 2 });
            drawLandmarks(this.ctx, results.leftHandLandmarks, { color: '#00FF00', lineWidth: 1 });
        }
        if (results.rightHandLandmarks) {
            drawConnectors(this.ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: '#00CC00', lineWidth: 2 });
            drawLandmarks(this.ctx, results.rightHandLandmarks, { color: '#FF0000', lineWidth: 1 });
        }
        this.ctx.restore();

        // Send to Backend
        const now = Date.now();
        if (now - this.lastSent > this.SEND_INTERVAL && !this.isSending) {
            this.lastSent = now;
            const keypoints = this.extractKeypoints(results);
            this.sendKeypoints(keypoints);
        }
    }

    private extractKeypoints(results: Results): number[] {
        // We replicate Python's vision.HandLandmarker behavior here.
        // It outputs hands sequentially rather than rigidly left/right.
        const features = new Array(126).fill(0);
        let handIndex = 0;

        const addHand = (landmarks: any[]) => {
            if (handIndex >= 2) return;
            for (let i = 0; i < 21; i++) {
                const lm = landmarks[i];
                features[handIndex * 63 + i * 3] = lm.x;
                features[handIndex * 63 + i * 3 + 1] = lm.y;
                features[handIndex * 63 + i * 3 + 2] = lm.z;
            }
            handIndex++;
        };

        // Mirror Python's priority: it grabs whichever hand is most prominent.
        // In local webcams with holistic, we just take anything present.
        if (results.rightHandLandmarks) addHand(results.rightHandLandmarks);
        if (results.leftHandLandmarks) addHand(results.leftHandLandmarks);

        return features;
    }

    private async sendKeypoints(keypoints: number[]) {
        this.isSending = true;
        try {
            // Read voicePref from chrome.storage.local (shared with the content script)
            const storageResult = await new Promise<Record<string, string>>((resolve) => {
                chrome.storage.local.get(['signmeet_voice_pref'], (result) => resolve(result as Record<string, string>));
            });
            const voicePref = storageResult['signmeet_voice_pref'] || 'MALE';

            const response = await fetch('http://localhost:3000/process-sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: this.USER_ID, 
                    keypoints,
                    voicePref
                })
            });
            const data = await response.json();

            // Replicate CV2 putText on the screen overlay
            let displayText = "";
            if (data.current_prediction) displayText += `${data.current_prediction}\n`;
            if (data.words) displayText += `${data.words}\n`;
            if (data.sentence) displayText += `${data.sentence}`;

            this.debugText.innerText = displayText;
            this.debugText.style.color = "rgba(254, 255, 254, 0.9)";
            this.debugText.style.textShadow = `
                -1px -1px 0 black,
                1px -1px 0 black,
                -1px  1px 0 black,
                1px  1px 0 black
            `;
            this.debugText.style.whiteSpace = "pre-wrap"; // Keep newlines

            // Note: Not constantly POSTing to Avatar for every single word anymore.
            // If the user wants the avatar to animate, we would send it here. But per request:
            // "dont convert it to audio for every word detection"
            // And now app.py natively speaks the output anyway using TTS!

        } catch (err) {
            this.debugText.innerText = "Err";
            this.debugText.style.color = "red";
        } finally {
            this.isSending = false;
        }
    }
}

// Start
const controller = new CameraController();
controller.start();
