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
    private readonly SEND_INTERVAL = 100;
    private readonly USER_ID = "extension_user_" + Math.floor(Math.random() * 1000);
    private animationFrameId: number | null = null;
    private debugText: HTMLDivElement;
    private stream: MediaStream | null = null;

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
        if (now - this.lastSent > this.SEND_INTERVAL) {
            this.lastSent = now;
            const keypoints = this.extractKeypoints(results);
            this.sendKeypoints(keypoints);
        }
    }

    private extractKeypoints(results: Results): number[] {
        let lh = new Array(21 * 3).fill(0);
        let rh = new Array(21 * 3).fill(0);

        if (results.leftHandLandmarks) {
            lh = [];
            for (const lm of results.leftHandLandmarks) lh.push(lm.x, lm.y, lm.z);
        }
        if (results.rightHandLandmarks) {
            rh = [];
            for (const lm of results.rightHandLandmarks) rh.push(lm.x, lm.y, lm.z);
        }

        return [...lh, ...rh];
    }

    private async sendKeypoints(keypoints: number[]) {
        try {
            const response = await fetch('http://localhost:3000/process-sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.USER_ID, keypoints })
            });
            const data = await response.json();

            if (data.word) {
                console.log("[SIGNMEET] 🎯 DETECTED:", data.word);
                this.debugText.innerText = data.word;
                this.debugText.style.color = "#0f0";

                // POST MESSAGE TO PARENT (Content Script)
                window.parent.postMessage({ type: 'SIGN_PREDICTION', word: data.word }, '*');

            } else if (data.buffer_length !== undefined) {
                this.debugText.innerText = `Buffer: ${data.buffer_length}`;
                this.debugText.style.color = "#aaa";
            }
        } catch (err) {
            this.debugText.innerText = "Err";
            this.debugText.style.color = "red";
        }
    }
}

// Start
const controller = new CameraController();
controller.start();
