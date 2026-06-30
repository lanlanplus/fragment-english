import { supabase } from './supabase.js';

export const FRAGMENTS_KEY = 'fragment-english-library';
export const GACHA_KEY_PREFIX = 'fragment-english-gacha-';
export const DIARY_KEY_PREFIX = 'diary:';
export const SETTINGS_KEY = 'fragment-english-settings';
export const SPEAKING_KEY = 'fragment-english-speaking';
export const APP_STATE_SYNCED_EVENT = 'fragment-english-state-synced';

const STATE_TABLE = 'user_states';
const CLOUD_KEYS = ['fragments', 'gacha', 'diaries', 'settings', 'speaking'];

function safeParse(value, fallback = null) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function emitStateSynced() {
  window.dispatchEvent(new Event(APP_STATE_SYNCED_EVENT));
}

function saveLocalJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

async function saveCloudSlice(key, value) {
  try {
    const user = await getCurrentUser();
    if (!user) return;

    await supabase
      .from(STATE_TABLE)
      .upsert(
        {
          user_id: user.id,
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      );
  } catch (error) {
    console.warn(`Cloud sync skipped for ${key}:`, error);
  }
}

function getLocalGachaMap() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(GACHA_KEY_PREFIX))
    .reduce((gacha, key) => {
      const date = key.replace(GACHA_KEY_PREFIX, '');
      const stored = safeParse(localStorage.getItem(key));
      if (!stored) return gacha;

      gacha[date] = Array.isArray(stored) ? { cards: stored, flippedIds: [] } : stored;
      return gacha;
    }, {});
}

function getDiaryKeys() {
  return Object.keys(localStorage).filter((key) => key.startsWith(DIARY_KEY_PREFIX));
}

function mergeById(primary = [], secondary = []) {
  return [...primary, ...secondary]
    .filter(Boolean)
    .reduce((items, item) => {
      if (!item.id || items.some((existing) => existing.id === item.id)) return items;
      return [...items, item];
    }, []);
}

function sortByNewest(items) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function getLocalAppState() {
  return {
    fragments: getFragments(),
    gacha: getLocalGachaMap(),
    diaries: getDiaries(),
    settings: getSettings(),
    speaking: getSpeakingState(),
  };
}

function mergeAppState(cloudState, localState) {
  return {
    fragments: sortByNewest(mergeById(localState.fragments, cloudState.fragments)),
    gacha: { ...cloudState.gacha, ...localState.gacha },
    diaries: sortByNewest(mergeById(localState.diaries, cloudState.diaries)),
    settings: { ...cloudState.settings, ...localState.settings },
    speaking: localState.speaking?.scene || localState.speaking?.messages?.length ? localState.speaking : cloudState.speaking,
  };
}

async function fetchCloudState(userId) {
  const { data, error } = await supabase.from(STATE_TABLE).select('key,value').eq('user_id', userId);
  if (error) throw error;

  return CLOUD_KEYS.reduce((state, key) => {
    const row = data?.find((item) => item.key === key);
    state[key] = row?.value ?? (key === 'gacha' || key === 'settings' || key === 'speaking' ? {} : []);
    return state;
  }, {});
}

async function saveCloudState(state) {
  await Promise.all(CLOUD_KEYS.map((key) => saveCloudSlice(key, state[key] ?? (key === 'gacha' || key === 'settings' || key === 'speaking' ? {} : []))));
}

export function getFragments() {
  return safeParse(localStorage.getItem(FRAGMENTS_KEY), []);
}

export function saveFragments(fragments) {
  saveLocalJson(FRAGMENTS_KEY, fragments);
  saveCloudSlice('fragments', fragments);
}

export function addFragment(fragment) {
  const nextFragments = [fragment, ...getFragments()];
  saveFragments(nextFragments);
  return nextFragments;
}

export function addVocabEntry({ text, sourceLabel }) {
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    source: text,
    translation: '已收录表达',
    scene: sourceLabel,
    better: '',
    sourceLabel,
    createdAt: now,
    updatedAt: now,
  };

  return addFragment(entry);
}

export function updateFragment(id, updates) {
  const nextFragments = getFragments().map((fragment) => (fragment.id === id ? { ...fragment, ...updates } : fragment));
  saveFragments(nextFragments);
  return nextFragments;
}

export function deleteFragment(id) {
  const nextFragments = getFragments().filter((fragment) => fragment.id !== id);
  saveFragments(nextFragments);
  return nextFragments;
}

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getDailyGacha() {
  const key = `${GACHA_KEY_PREFIX}${getTodayKey()}`;
  const stored = safeParse(localStorage.getItem(key));
  if (!stored) return null;
  return Array.isArray(stored) ? { cards: stored, flippedIds: [] } : stored;
}

export function saveDailyGacha(cards, flippedIds = []) {
  const key = `${GACHA_KEY_PREFIX}${getTodayKey()}`;
  const gacha = { cards, flippedIds };
  saveLocalJson(key, gacha);
  saveCloudSlice('gacha', getLocalGachaMap());
}

export function getDiaries() {
  return getDiaryKeys()
    .map((key) => safeParse(localStorage.getItem(key)))
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function saveDiary(entry) {
  saveLocalJson(`${DIARY_KEY_PREFIX}${entry.id}`, entry);
  saveCloudSlice('diaries', getDiaries());
}

export function deleteDiary(id) {
  localStorage.removeItem(`${DIARY_KEY_PREFIX}${id}`);
  const nextDiaries = getDiaries();
  saveCloudSlice('diaries', nextDiaries);
  return nextDiaries;
}

export function getSettings() {
  const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), {});
  return {
    ...savedSettings,
    theme: savedSettings.theme || localStorage.getItem('theme') || 'purple',
  };
}

export function saveSettings(settings) {
  const nextSettings = { ...getSettings(), ...settings };
  saveLocalJson(SETTINGS_KEY, nextSettings);
  if (nextSettings.theme) localStorage.setItem('theme', nextSettings.theme);
  saveCloudSlice('settings', nextSettings);
}

export function getSpeakingState() {
  return safeParse(localStorage.getItem(SPEAKING_KEY), { scene: '', messages: [], summary: '' });
}

export function saveSpeakingState(state) {
  saveLocalJson(SPEAKING_KEY, state);
  saveCloudSlice('speaking', state);
}

export function clearSpeakingState() {
  const emptyState = { scene: '', messages: [], summary: '' };
  saveLocalJson(SPEAKING_KEY, emptyState);
  saveCloudSlice('speaking', emptyState);
}

export async function syncUserState(user) {
  if (!user) return { ok: false, message: '请先登录。' };

  try {
    const localState = getLocalAppState();
    const cloudState = await fetchCloudState(user.id);
    const mergedState = mergeAppState(cloudState, localState);
    applyAppState(mergedState);
    await saveCloudState(mergedState);
    emitStateSynced();
    return { ok: true, message: '云端同步完成。' };
  } catch (error) {
    return {
      ok: false,
      message: error.message || '云端同步暂时失败，本地数据仍可继续使用。',
    };
  }
}

export function applyAppState(state) {
  saveLocalJson(FRAGMENTS_KEY, state.fragments || []);

  Object.entries(state.gacha || {}).forEach(([date, value]) => {
    saveLocalJson(`${GACHA_KEY_PREFIX}${date}`, Array.isArray(value) ? { cards: value, flippedIds: [] } : value);
  });

  (state.diaries || []).forEach((entry) => {
    saveLocalJson(`${DIARY_KEY_PREFIX}${entry.id}`, entry);
  });

  saveSettings(state.settings || {});
  saveLocalJson(SPEAKING_KEY, state.speaking || { scene: '', messages: [], summary: '' });
}
