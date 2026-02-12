import React from 'react';
import { createRoot } from 'react-dom/client';
import { Overlay } from './Overlay';

console.log("[SignMeet] Content Script Initializing...");

function initExtension() {
    try {
        if (!document.body) {
            console.warn("[SignMeet] document.body is missing, retrying...");
            setTimeout(initExtension, 100);
            return;
        }

        const existingRoot = document.getElementById('signmeet-root');
        if (existingRoot) {
            console.log("[SignMeet] Extension already loaded.");
            return;
        }

        // 1. Create a container that doesn't conflict with GMeet styles
        const extensionRoot = document.createElement('div');
        extensionRoot.id = 'signmeet-root';
        extensionRoot.style.position = 'fixed'; // Ensure it's not hidden by flow
        extensionRoot.style.top = '0';
        extensionRoot.style.left = '0';
        extensionRoot.style.width = '100%';
        extensionRoot.style.height = '100%';
        extensionRoot.style.pointerEvents = 'none'; // Click-through by default
        extensionRoot.style.zIndex = '9999999'; // Highest layer
        document.body.appendChild(extensionRoot);

        // 2. Render
        const root = createRoot(extensionRoot);
        root.render(<Overlay />);

        console.log("[SignMeet] Extension UI Mounted successfully.");

    } catch (error) {
        console.error("[SignMeet] Fatal Initialization Error:", error);
    }
}

// Ensure execution
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    initExtension();
}