import pyttsx3
import pythoncom
import time

pythoncom.CoInitialize()

engine = pyttsx3.init()
voices = engine.getProperty('voices')

print("Available voices:")
for i, v in enumerate(voices):
    print(f"  [{i}] {v.name} | ID: {v.id}")

print("\n--- Speaking with MALE voice (David) ---")
engine.setProperty('voice', voices[0].id)
engine.setProperty('rate', 160)
engine.say("This is the male voice. Hello, I am David.")
engine.runAndWait()
time.sleep(1)

print("\n--- Speaking with FEMALE voice (Zira) ---")
engine.setProperty('voice', voices[1].id)
engine.setProperty('rate', 160)
engine.say("This is the female voice. Hello, I am Zira.")
engine.runAndWait()

print("\nDone.")
