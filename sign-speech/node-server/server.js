const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const PYTHON_SERVICE_URL = 'http://127.0.0.1:5001';

app.use(cors());
// Increase limit for Base64 video frames
app.use(bodyParser.json({ limit: '10mb' }));

// --- ROUTE: Process Sign Language ---
// The Frontend calls this continuously with MediaPipe Keypoints
app.post('/process-sign', async (req, res) => {
    try {
        const { userId, keypoints, voicePref } = req.body;
        if (!userId || !keypoints) {
            return res.status(400).json({ error: "Missing userId or keypoints data" });
        }



        // Forward to Python AI Service
        const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/predict`, {
            userId: userId,
            keypoints: keypoints,
            voicePref: voicePref || 'MALE'
        });

        // Return the prediction (or null) back to Frontend
        res.json(pythonResponse.data);

    } catch (error) {
        // console.error("AI Service Error:", error.message);
        // Don't spam console if python service is just starting up or transient error
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: "AI Service failed" });
        }
    }
});

// --- ROUTE: Reset/Clear Buffer (The 'C' Key) ---
app.post('/reset-sign', async (req, res) => {
    try {
        const { userId } = req.body;
        await axios.post(`${PYTHON_SERVICE_URL}/reset`, { userId });
        res.json({ message: "Buffer cleared" });
    } catch (error) {
        res.status(500).json({ error: "Reset failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Node Server running on http://localhost:${PORT}`);
    console.log(`Make sure Python AI Service is running on Port 5001`);
});