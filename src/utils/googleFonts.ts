export interface FontOption {
  name: string;
  family: string;
  category: 'handwriting' | 'sans-serif' | 'serif' | 'monospace';
  sampleText?: string;
}

export const POPULAR_HANDWRITING_FONTS: FontOption[] = [
  { name: 'Kalam', family: 'Kalam', category: 'handwriting', sampleText: 'Creativity is intelligence having fun.' },
  { name: 'Reenie Beanie', family: 'Reenie Beanie', category: 'handwriting', sampleText: 'Quick sticky note text here!' },
  { name: 'Caveat', family: 'Caveat', category: 'handwriting', sampleText: 'Express your thoughts smoothly' },
  { name: 'Architects Daughter', family: 'Architects Daughter', category: 'handwriting', sampleText: 'System blueprint & wireframe' },
  { name: 'Patrick Hand', family: 'Patrick Hand', category: 'handwriting', sampleText: 'Neat & tidy handwriting style' },
  { name: 'Indie Flower', family: 'Indie Flower', category: 'handwriting', sampleText: 'Carefree & playful doodles' },
  { name: 'Gochi Hand', family: 'Gochi Hand', category: 'handwriting', sampleText: 'Chalkboard style lettering' },
  { name: 'Shadows Into Light', family: 'Shadows Into Light', category: 'handwriting', sampleText: 'Subtle clean cursive notes' },
  { name: 'Amatic SC', family: 'Amatic SC', category: 'handwriting', sampleText: 'TALL CONDENSED HANDWRITING' },
  { name: 'Gloria Hallelujah', family: 'Gloria Hallelujah', category: 'handwriting', sampleText: 'Bold comic strip lettering' },
  { name: 'Permanent Marker', family: 'Permanent Marker', category: 'handwriting', sampleText: 'MARKER HIGHLIGHT NOTE' },
  { name: 'Handlee', family: 'Handlee', category: 'handwriting', sampleText: 'Casual rounded pencil script' },
  { name: 'Sacramento', family: 'Sacramento', category: 'handwriting', sampleText: 'Elegant cursive flow' },
  { name: 'Rock Salt', family: 'Rock Salt', category: 'handwriting', sampleText: 'Raw felt marker style' },
];

const loadedFonts = new Set<string>();

/**
 * Dynamically loads a Google Font into the page <head>
 */
export function loadGoogleFont(fontFamily: string): Promise<void> {
  return new Promise((resolve) => {
    if (loadedFonts.has(fontFamily)) {
      resolve();
      return;
    }

    // Standard CSS font fallbacks don't need Google loading
    if (['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'sans-serif'].includes(fontFamily)) {
      resolve();
      return;
    }

    const formattedName = fontFamily.trim().replace(/\s+/g, '+');
    const linkId = `google-font-${formattedName}`;

    if (document.getElementById(linkId)) {
      loadedFonts.add(fontFamily);
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;700&display=swap`;
    
    link.onload = () => {
      loadedFonts.add(fontFamily);
      resolve();
    };

    link.onerror = () => {
      console.warn(`Failed to load Google Font: ${fontFamily}`);
      resolve(); // resolve anyway so app continues
    };

    document.head.appendChild(link);
  });
}

/**
 * Preloads standard handwriting fonts on startup
 */
export function preloadDefaultFonts() {
  POPULAR_HANDWRITING_FONTS.slice(0, 8).forEach(font => {
    loadGoogleFont(font.family);
  });
}
