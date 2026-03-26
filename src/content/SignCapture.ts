// src/content/SignCapture.ts

export class SignCapture {
    private iframe: HTMLIFrameElement | null = null;
    private container: HTMLDivElement;
    private onPrediction: (text: string) => void;
    private isVisible = false;

    private boundHandleMessage: (event: MessageEvent) => void;

    constructor(onPrediction: (text: string) => void) {
        this.onPrediction = onPrediction;
        this.boundHandleMessage = this.handleMessage.bind(this);

        // Container for Iframe
        this.container = document.createElement('div');
        this.container.id = "signmeet-iframe-container";
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 320px;
            height: 240px;
            z-index: 999999;
            border-radius: 12px;
            overflow: hidden;
            background: #000;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            border: 2px solid #333;
            transform: scaleX(1); /* No mirror on container, camera page handles mirroring */
            display: none;
        `;

        // Listen for messages from iframe
        window.addEventListener('message', this.boundHandleMessage);
    }

    public start() {
        console.log("[SIGNMEET] Starting Camera Iframe...");

        if (!this.iframe) {
            this.iframe = document.createElement('iframe');
            this.iframe.src = chrome.runtime.getURL('camera.html');
            this.iframe.style.cssText = "width: 100%; height: 100%; border: none;";
            this.iframe.allow = "camera; microphone";
            this.container.appendChild(this.iframe);
            document.body.appendChild(this.container);
        }

        this.container.style.display = 'block';
        this.isVisible = true;
    }

    // Call this whenever the user changes the voice preference dropdown
    public setVoicePref(pref: string) {
        if (this.iframe && this.iframe.contentWindow) {
            this.iframe.contentWindow.postMessage({ type: 'VOICE_PREF', pref }, '*');
        }
    }

    public stop() {
        console.log("[SIGNMEET] Stopping Camera Iframe...");
        window.removeEventListener('message', this.boundHandleMessage);

        this.container.style.display = 'none';
        this.isVisible = false;

        // Optional: Remove iframe entirely to stop camera
        if (this.iframe) {
            this.iframe.src = ''; // Kill the page
            this.container.removeChild(this.iframe);
            this.iframe = null;
        }
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
    }

    private handleMessage(event: MessageEvent) {
        // Validate origin? chrome-extension://...
        // event.origin should match chrome-extension://<id>

        if (event.data && event.data.type === 'SIGN_PREDICTION') {
            const word = event.data.word;
            if (word) {
                console.log("[SIGNMEET] Received Prediction:", word);
                this.onPrediction(word.toUpperCase());
            }
        }
    }
}
