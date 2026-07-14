import { translateSource } from './deepseekTranslate.js';
import { updateFragment } from './storage.js';

export async function enrichVocabEntry(entry) {
  try {
    const translated = await translateSource(entry.source);
    return updateFragment(entry.id, {
      translation: translated.translation,
      scene: translated.scene,
      better: translated.better,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return updateFragment(entry.id, {
      translation: '已收录表达',
      scene: '',
      better: '',
      updatedAt: new Date().toISOString(),
    });
  }
}
