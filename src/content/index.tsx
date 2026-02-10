import React from 'react';
import { createRoot } from 'react-dom/client';
import { Overlay } from './Overlay';

// 1. Create a container that doesn't conflict with GMeet styles
const extensionRoot = document.createElement('div');
extensionRoot.id = 'signmeet-root';
document.body.appendChild(extensionRoot);

// 2. Render
const root = createRoot(extensionRoot);
root.render(<Overlay />);

console.log("SignMeet: Extension Loaded.");