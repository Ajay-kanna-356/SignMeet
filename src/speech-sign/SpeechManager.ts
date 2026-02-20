// src/speech-sign/SpeechManager.ts

const DICTIONARY: Record<string, string> = {
  'hello': 'hello', 'hi': 'hello',
  'cool': 'cool', 'awesome': 'cool',
  'good': 'good', 'great': 'good',
  'alright': 'alright', 'ok': 'alright', 'okay': 'alright',

  'technology': 'technology', 'tech': 'technology',
  'job': 'job', 'work': 'job',
  'new': 'new', 'fresh': 'new',
  'secretary': 'secretary', 'assistant': 'secretary',

  'sorry': 'sorry', 'apologize': 'sorry', 'apology': 'sorry',
  'team': 'team', 'group': 'team',
  'thank you': 'thankyou', 'thanks': 'thankyou',

  // Newly added
  'finish': 'finish', 'end': 'finish', 'complete': 'finish',
  'start': 'start', 'begin': 'start',
  'meeting': 'meeting', 'meet': 'meeting',

  'we': 'we', 'us': 'we',
  'you': 'you',
  'me': 'me', 'i': 'me',

  'what': 'what',

  'tomorrow': 'tomorrow',
  'yesterday': 'yesterday',

  // 'help': 'help', 'assist': 'help', // DISABLED: help.glb missing from public/assets — add the file to re-enable
  'no': 'no', 'not': 'no',

  'problem': 'problem', 'issue': 'problem',
};

export class SpeechManager {
  private queue: string[] = [];
  // Change: Store words array instead of raw string for precise diffing
  private lastProcessedWords: string[] = [];
  private onQueueChange: (queue: string[]) => void;

  constructor(onQueueUpdate: (queue: string[]) => void) {
    this.onQueueChange = onQueueUpdate;
  }

  public processSentence(sentence: string) {
    // 1. Clean the incoming sentence
    const cleanSentence = sentence.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

    if (!cleanSentence) return;

    // 2. Split into words immediately
    const currentWords = cleanSentence.split(/\s+/);

    // 3. Find the divergence point
    // We compare the new word list with the old one index by index.
    // As soon as we find a mismatch, we consider everything from that point onwards as "new".
    let diffIndex = 0;
    const len = Math.min(this.lastProcessedWords.length, currentWords.length);

    while (diffIndex < len) {
      if (this.lastProcessedWords[diffIndex] !== currentWords[diffIndex]) {
        break;
      }
      diffIndex++;
    }

    // 4. Extract only the NEW words (from diffIndex to the end)
    const newWords = currentWords.slice(diffIndex);

    // Update memory to the current state
    this.lastProcessedWords = currentWords;

    if (newWords.length === 0) return;

    // 5. Process the new words for animations
    const newAnims: string[] = [];

    newWords.forEach(word => {
      if (DICTIONARY[word]) {
        newAnims.push(DICTIONARY[word]);
      }
    });

    if (newAnims.length > 0) {
      console.log(`[SIGNMEET] Match Found: ${newAnims.join(', ')}`);

      // CRITICAL FIX: Do not append to history. Only send the new batch.
      // The AvatarController maintains its own internal playlist, so we 
      // just need to feed it the new items.
      this.queue = newAnims;
      this.onQueueChange(this.queue);
    }
  }

  public shiftQueue() {
    // This function is likely called by the UI when it consumes the queue.
    // We clear the local queue to prevent re-emitting the same batch.
    this.queue = [];
    this.onQueueChange([]);
  }

  public clearMemory() {
    this.lastProcessedWords = [];
    this.queue = [];
    this.onQueueChange([]);
  }
}