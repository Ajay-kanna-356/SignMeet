import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

for model in ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "groq/compound"]:
    try:
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Convert this sign language gloss into a natural English sentence. Return ONLY the sentence: 'hello team good job thank'"}]
        )
        print(f"Model [{model}] Output: {res.choices[0].message.content.strip()}")
    except Exception as e:
        print(f"Model [{model}] Error: {e}")
