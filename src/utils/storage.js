export const FRAGMENTS_KEY = 'fragment-english-library';
export const GACHA_KEY_PREFIX = 'fragment-english-gacha-';

export function getFragments() {
  try {
    return JSON.parse(localStorage.getItem(FRAGMENTS_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveFragments(fragments) {
  localStorage.setItem(FRAGMENTS_KEY, JSON.stringify(fragments));
}

export function addFragment(fragment) {
  const nextFragments = [fragment, ...getFragments()];
  saveFragments(nextFragments);
  return nextFragments;
}

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getDailyGacha() {
  const key = `${GACHA_KEY_PREFIX}${getTodayKey()}`;
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function saveDailyGacha(cards) {
  localStorage.setItem(`${GACHA_KEY_PREFIX}${getTodayKey()}`, JSON.stringify(cards));
}
