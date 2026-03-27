import asyncio
import edge_tts
import pygame
import tempfile
import os
import time

async def generate_audio(text, voice, path):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(path)

print("Testing edge-tts Tamil Female voice...")
with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as f:
    tmp = f.name

asyncio.run(generate_audio("வணக்கம். என் பெயர் பல்லவி. நான் நலமாக இருக்கிறேன்.", "ta-IN-PallaviNeural", tmp))
print(f"Audio saved to {tmp}, size: {os.path.getsize(tmp)} bytes")

pygame.mixer.init()
pygame.mixer.music.load(tmp)
pygame.mixer.music.play()
print("Playing...")
while pygame.mixer.music.get_busy():
    time.sleep(0.1)
pygame.mixer.music.unload()
os.unlink(tmp)
print("Done.")
