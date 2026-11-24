/**
 * The game's font (GDD §10, owner's choice 2026-11-24): Chakra Petch by Cadson Demak,
 * SIL Open Font License 1.1 (public/licenses/ChakraPetch-OFL.txt), via @fontsource.
 * Bundled with the game so every device shows the same letters. The Preloader waits
 * for it; pixelText.ts draws with it.
 */
import thai400 from '@fontsource/chakra-petch/files/chakra-petch-thai-400-normal.woff2?url';
import latin400 from '@fontsource/chakra-petch/files/chakra-petch-latin-400-normal.woff2?url';
import thai700 from '@fontsource/chakra-petch/files/chakra-petch-thai-700-normal.woff2?url';
import latin700 from '@fontsource/chakra-petch/files/chakra-petch-latin-700-normal.woff2?url';

export const FONT_FAMILY = 'Chakra Petch';

const THAI_RANGE = 'U+0E01-0E5B, U+200C-200D, U+25CC';
const LATIN_RANGE = 'U+0000-00FF, U+2000-206F, U+2190-2193, U+2212';

const FILES = [
  { url: thai400, weight: '400', range: THAI_RANGE },
  { url: latin400, weight: '400', range: LATIN_RANGE },
  { url: thai700, weight: '700', range: THAI_RANGE },
  { url: latin700, weight: '700', range: LATIN_RANGE },
];

let loading: Promise<void> | null = null;

/** Load the font once; resolves when canvas text can use it. */
export function loadGameFont(): Promise<void> {
  loading ??= Promise.all(
    FILES.map(async (f) => {
      const face = new FontFace(FONT_FAMILY, `url(${f.url})`, { weight: f.weight, unicodeRange: f.range });
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => undefined);
  return loading;
}
