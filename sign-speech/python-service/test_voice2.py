import subprocess

def speak_ps(text, voice_name):
    ps_script = (
        f'Add-Type -AssemblyName System.Speech; '
        f'$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; '
        f'$s.SelectVoice("{voice_name}"); '
        f'$s.Rate = 1; '
        f'$s.Speak("{text}");'
    )
    subprocess.run(["powershell", "-Command", ps_script], check=True)

print("Speaking MALE (David)...")
speak_ps("Hello, I am David. This is the male voice.", "Microsoft David Desktop")

print("Speaking FEMALE (Zira)...")
speak_ps("Hello, I am Zira. This is the female voice.", "Microsoft Zira Desktop")

print("Done.")
