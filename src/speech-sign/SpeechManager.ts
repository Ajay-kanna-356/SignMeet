// src/speech-sign/SpeechManager.ts

const DICTIONARY: Record<string, string> = {
  'hello': 'hello', 'hi': 'hello',
  'cool': 'cool', 'awesome': 'cool',
  'good': 'good', 'great': 'good',
  'alright': 'alright', 'ok': 'alright'
};

export class SpeechManager {
  private queue: string[] = [];
  private lastProcessedSentence = "";
  private onQueueChange: (queue: string[]) => void;

  constructor(onQueueUpdate: (queue: string[]) => void) {
    this.onQueueChange = onQueueUpdate;
  }

  public processSentence(sentence: string) {
    // 1. Clean the incoming sentence
    const cleanSentence = sentence.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

    if (!cleanSentence) return;
    if (cleanSentence === this.lastProcessedSentence) return;

    // 2. Extract only NEW words
    let newText = "";

    // Check if the new sentence is just an extension of the old one
    if (cleanSentence.startsWith(this.lastProcessedSentence)) {
      newText = cleanSentence.substring(this.lastProcessedSentence.length).trim();
    } else {
      // The sentence changed completely (new speaker or Google correction)
      // We process the whole thing to be safe, or you could try to find the diff
      newText = cleanSentence;
    }

    this.lastProcessedSentence = cleanSentence;

    if (!newText) return;

    const words = newText.split(/\s+/);
    const newAnims: string[] = [];
    let lastAddedWord = "";
    words.forEach(word => {
      // 1. Skip if it's the exact same word as immediately before (Meet glitch)
      if (word === lastAddedWord) return;

      // 2. Match against dictionary
      if (DICTIONARY[word]) {
        newAnims.push(DICTIONARY[word]);
        lastAddedWord = word;
      }
    });

    if (newAnims.length > 0) {
      console.log(`[SIGNMEET] Match Found: ${newAnims.join(', ')}`);
      this.queue = [...this.queue, ...newAnims];
      this.onQueueChange(this.queue);
    }
  }

  public shiftQueue() {
    this.queue.shift();
    this.onQueueChange([...this.queue]);
  }

  public clearMemory() {
    this.lastProcessedSentence = "";
    this.queue = [];
    this.onQueueChange([]);
  }
}