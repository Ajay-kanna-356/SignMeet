// src/firebase/db.ts

// This simulates a database. Ideally, this data comes from Firestore.
const ANIMATION_MAP: Record<string, string> = {
    "hello": "assets/anim_hello.glb",
    "thank you": "assets/anim_thanks.glb",
    "please": "assets/anim_please.glb",
    "meet": "assets/anim_meet.glb",
    // ... add your dictionary here
};

export const getAnimationUrl = async (word: string): Promise<string | null> => {
    // In the future: Fetch from Firestore
    // const doc = await getDoc(doc(db, "signs", word));
    
    // For now: Local lookup
    if (ANIMATION_MAP[word]) {
        return chrome.runtime.getURL(ANIMATION_MAP[word]); 
    }
    return null;
};