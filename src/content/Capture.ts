// src/content/Capture.ts

export class MeetCaptionCapture {
  private observer: MutationObserver | null = null;
  private callback: (text: string) => void;
  private lastText: string = "";

  // List of known speaker names to ignore (Case Insensitive)
  // We can also filter these out dynamically if they appear at the start of a block
  private readonly UI_JUNK = ["format_size", "font size", "settings", "language", "english", "closed captions"];

  constructor(onNewSpeech: (text: string) => void) {
    this.callback = onNewSpeech;
  }

  public start() {
    console.log("[SIGNMEET] Capture Started. Baselining existing text...");

    // 1. Initial snapshot: Capture what's currently on screen and save it to lastText 
    // This prevents the avatar from performing signs for stuff said 5 minutes ago.
    this.extractText(true);

    // 2. Start observing for CHANGES
    this.observer = new MutationObserver(() => {
      this.extractText(false);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  public stop() {
    this.observer?.disconnect();
  }

  private extractText(isInitialBaseline: boolean = false) {
    // 1. SKIP if we're in a settings/menu dialog
    const settingsDialog = document.querySelector('[role="dialog"], [role="menu"]');
    if (settingsDialog && settingsDialog.textContent?.includes('language')) {
      return; // Ignore settings menu
    }

    // 2. Try to find the caption container (Broad search)
    const container = document.querySelector('div[role="region"][aria-label="Captions"], .a4cQT, div[jscontroller="Mx5RQq"]');

    if (!container) return;

    // 3. Target the text elements (Broad search)
    const textElements = container.querySelectorAll('span, .VbkSUe, [jsname="tS79ce"]');

    if (textElements.length === 0) return;

    // 3. Process the text and filter out duplicates and junk
    let validWords: string[] = [];
    let seenChunks = new Set<string>();

    textElements.forEach((el) => {
      const text = (el as HTMLElement).innerText.trim().toLowerCase();
      if (!text || text.length < 2) return;

      // Skip if this specific chunk was already seen in this DOM snapshot
      // (Google Meet often has redundant/duplicate spans)
      if (seenChunks.has(text)) return;
      seenChunks.add(text);

      const isJunk = this.UI_JUNK.some(junk => text.includes(junk));
      const isSpeakerName = el.classList.contains('ade6rb') || el.getAttribute('jsname') === 'Z98uS';

      if (!isJunk && !isSpeakerName) {
        validWords.push(text);
      }
    });

    const cleanText = validWords.join(" ").trim();

    // 4. Send to avatar if the text has changed
    if (cleanText && cleanText !== this.lastText) {
      this.lastText = cleanText;

      // ONLY trigger the avatar if we are NOT in the initial setup phase
      if (!isInitialBaseline) {
        console.log(`[SIGNMEET] New Speech Detected: ${cleanText}`);
        this.callback(cleanText);
      }
    }
  }
}