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
    console.log("[SIGNMEET] Fail-Safe Capture Started.");
    
    this.observer = new MutationObserver(() => {
      this.extractText();
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

  private extractText() {
    // 1. Try to find the most common caption containers
    // We use a broader selector because aria-label might be on a parent or child
    const container = document.querySelector('div[role="region"][aria-label="Captions"], .a4cQT, div[jscontroller="Mx5RQq"]');
    
    if (!container) return;

    // 2. Target the specific elements that hold the text lines
    // In your screenshot, these were divs like .VbkSUe or spans
    const textElements = container.querySelectorAll('span, .VbkSUe, [jsname="tS79ce"]');
    
    if (textElements.length === 0) return;

    // 3. Process the text and filter out "Speaker Names" and "UI Metadata"
    let validWords: string[] = [];

    textElements.forEach((el) => {
      const text = (el as HTMLElement).innerText.trim().toLowerCase();
      
      // SKIP if:
      // - It's empty
      // - It's one of the UI junk words (format_size, etc.)
      // - It looks like a speaker name (usually found in a div with no jsname or specific classes)
      const isJunk = this.UI_JUNK.some(junk => text.includes(junk));
      
      // Name Filter Logic: In Meet, names are often in divs that don't have the "tS79ce" jsname
      // If the element is a speaker name container, we skip it.
      const isSpeakerName = el.classList.contains('ade6rb') || el.getAttribute('jsname') === 'Z98uS';

      if (text && !isJunk && !isSpeakerName && text.length > 1) {
        validWords.push(text);
      }
    });

    const cleanText = validWords.join(" ").trim();

    // 4. Send to avatar if the text has changed
    if (cleanText && cleanText !== this.lastText) {
      // Check if the current text is just a repeat of the last (Meet often appends text)
      // We only want the new part
      this.lastText = cleanText;
      console.log(`[SIGNMEET] Clean Speech: ${cleanText}`);
      this.callback(cleanText);
    }
  }
}