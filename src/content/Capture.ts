// src/content/Capture.ts

export class MeetCaptionCapture {
  private observer: MutationObserver | null = null;
  private callback: (text: string, speaker?: string) => void;
  private lastText: string = "";
  private lastSpeaker: string = "";

  // List of known UI junk to ignore (Case Insensitive)
  private readonly UI_JUNK = ["format_size", "font size", "settings", "language", "english", "closed captions"];

  constructor(onNewSpeech: (text: string, speaker?: string) => void) {
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

    // 3. Extract Speaker Name strictly via .NWpY1d (Do NOT use .notranslate)
    let currentSpeaker = "";
    const speakerElements = container.querySelectorAll('.NWpY1d');
    if (speakerElements.length > 0) {
      const latestSpeakerEl = speakerElements[speakerElements.length - 1] as HTMLElement;
      currentSpeaker = latestSpeakerEl.innerText?.trim() || latestSpeakerEl.textContent?.trim() || "";
    } else {
      // Fallback check within document in case container query was narrow
      const docSpeakerElements = document.querySelectorAll('.NWpY1d');
      if (docSpeakerElements.length > 0) {
        const latestSpeakerEl = docSpeakerElements[docSpeakerElements.length - 1] as HTMLElement;
        currentSpeaker = latestSpeakerEl.innerText?.trim() || latestSpeakerEl.textContent?.trim() || "";
      }
    }

    // 4. Target the text elements (Broad search)
    const textElements = container.querySelectorAll('span, .VbkSUe, [jsname="tS79ce"]');

    if (textElements.length === 0) {
      if (currentSpeaker && currentSpeaker !== this.lastSpeaker) {
        this.lastSpeaker = currentSpeaker;
        if (!isInitialBaseline) {
          console.log(`[SIGNMEET] Speaker Changed: ${currentSpeaker}`);
          this.callback(this.lastText, currentSpeaker);
        }
      }
      return;
    }

    // 5. Process the text and filter out duplicates, junk, and speaker elements
    let validWords: string[] = [];
    let seenChunks = new Set<string>();

    textElements.forEach((el) => {
      // Exclude any element that is part of the speaker name or container
      const isSpeakerName = Boolean(
        el.closest('.NWpY1d, .adE6rb, .ade6rb, .KcIKyf, [jsname="Z98uS"]') ||
        el.querySelector('.NWpY1d, .adE6rb, .ade6rb, .KcIKyf, [jsname="Z98uS"]') ||
        el.classList.contains('NWpY1d') ||
        el.classList.contains('adE6rb') ||
        el.classList.contains('ade6rb') ||
        el.getAttribute('jsname') === 'Z98uS'
      );

      if (isSpeakerName) return;

      const text = (el as HTMLElement).innerText?.trim().toLowerCase() || "";
      if (!text || text.length < 2) return;

      // Skip if this specific chunk was already seen in this DOM snapshot
      // (Google Meet often has redundant/duplicate spans)
      if (seenChunks.has(text)) return;
      seenChunks.add(text);

      const isJunk = this.UI_JUNK.some(junk => text.includes(junk));
      if (!isJunk) {
        validWords.push(text);
      }
    });

    let cleanText = validWords.join(" ").trim();

    // If text begins with "Speaker Name:" prefix, strip it
    if (currentSpeaker) {
      const speakerPrefixRegex = new RegExp(`^${currentSpeaker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-]\\s*`, 'i');
      cleanText = cleanText.replace(speakerPrefixRegex, '').trim();
    }

    // 6. Handle baseline vs live updates
    if (isInitialBaseline) {
      this.lastText = cleanText;
      this.lastSpeaker = currentSpeaker;
      if (currentSpeaker) {
        this.callback("", currentSpeaker);
      }
      return;
    }

    const textChanged = cleanText && cleanText !== this.lastText;
    const speakerChanged = Boolean(currentSpeaker && currentSpeaker !== this.lastSpeaker);

    if (textChanged || speakerChanged) {
      if (textChanged) {
        this.lastText = cleanText;
      }
      if (speakerChanged) {
        this.lastSpeaker = currentSpeaker;
      }

      console.log(`[SIGNMEET] Caption Update | Speaker: "${currentSpeaker}" | Speech: "${cleanText}"`);
      this.callback(cleanText, currentSpeaker);
    }
  }
}