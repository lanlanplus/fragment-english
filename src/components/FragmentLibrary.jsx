import { useEffect, useRef, useState } from 'react';
import { askDeepSeek, parseJsonResponse } from '../services/deepseek.js';
import { APP_STATE_SYNCED_EVENT, addFragment, addVocabEntry, deleteFragment, getFragments, updateFragment } from '../utils/storage.js';

const translateSystemPrompt = `你是一个英语生活助理。用户会发给你一个英文句子或词，请返回以下三项，用 JSON 格式输出，不要有多余文字：
{
  "translation": "中文翻译",
  "scene": "一句话说明这个表达在什么场景用（口语化）",
  "better": "更地道的替换表达，如果没有则返回空字符串"
}`;

export default function FragmentLibrary() {
  const [input, setInput] = useState('');
  const [fragments, setFragments] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingSource, setEditingSource] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [notice, setNotice] = useState('');
  const [speakingId, setSpeakingId] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const speakingIdRef = useRef('');

  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supportsSpeechRecognition = Boolean(SpeechRecognition);

  useEffect(() => {
    setFragments(getFragments());

    const refreshFragments = () => {
      setFragments(getFragments());
    };

    window.addEventListener(APP_STATE_SYNCED_EVENT, refreshFragments);
    return () => window.removeEventListener(APP_STATE_SYNCED_EVENT, refreshFragments);
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  const getEnglishVoice = () => {
    const voices = window.speechSynthesis?.getVoices() || [];
    const preferredVoice = voices.find((voice) => voice.name.includes('Google US English') || voice.name.includes('Samantha'));
    return preferredVoice || voices.find((voice) => voice.lang === 'en-US') || null;
  };

  const speakEnglish = (text, id) => {
    if (!window.speechSynthesis || !text) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      speakingIdRef.current = '';
      setSpeakingId('');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.voice = getEnglishVoice();
    utterance.onend = () => {
      if (speakingIdRef.current === id) {
        speakingIdRef.current = '';
        setSpeakingId('');
      }
    };
    utterance.onerror = () => {
      if (speakingIdRef.current === id) {
        speakingIdRef.current = '';
        setSpeakingId('');
      }
    };
    speakingIdRef.current = id;
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const translateSource = async (source) => {
    const text = await askDeepSeek([
      { role: 'system', content: translateSystemPrompt },
      { role: 'user', content: source },
    ]);
    const result = parseJsonResponse(text);
    return {
      source,
      translation: result.translation || '',
      scene: result.scene || '',
      better: result.better || '',
    };
  };

  const handleTranslate = async (sourceOverride) => {
    const source = (typeof sourceOverride === 'string' ? sourceOverride : input).trim();
    if (!source || status === 'loading') return;

    setStatus('loading');
    setError('');
    setNotice('');

    try {
      const translated = await translateSource(source);
      const now = new Date().toISOString();
      const fragment = {
        id: crypto.randomUUID(),
        ...translated,
        createdAt: now,
        updatedAt: now,
      };

      const nextFragments = addFragment(fragment);
      setFragments(nextFragments);
      setInput('');
      setStatus('success');
    } catch {
      setError('翻译刚刚走神了，再点一次试试。');
      setStatus('idle');
    }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditingSource(item.source);
    setDeleteConfirmId('');
    setNotice('');
    setError('');
  };

  const cancelEditing = () => {
    setEditingId('');
    setEditingSource('');
  };

  const saveEdit = async (item) => {
    const source = editingSource.trim();
    if (!source || status === 'loading') return;

    setStatus('loading');
    setError('');
    setNotice('');

    try {
      const translated = await translateSource(source);
      const nextFragments = updateFragment(item.id, {
        ...translated,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString(),
      });
      setFragments(nextFragments);
      cancelEditing();
      setStatus('success');
      setNotice('这条碎片已经重新整理好。');
    } catch {
      setError('这条刚刚没改成功，再试一次。');
      setStatus('idle');
    }
  };

  const confirmDelete = (id) => {
    const nextFragments = deleteFragment(id);
    setFragments(nextFragments);
    setDeleteConfirmId('');
    setNotice('已经把这条轻轻放走了。');
  };

  const collectBetter = (better) => {
    const text = better.trim();
    if (!text) return;

    const nextFragments = addVocabEntry({
      text,
      sourceLabel: '来自碎片翻译-地道表达',
    });
    setFragments(nextFragments);
    setNotice('地道表达已收进词库。');
  };

  const startVoiceInput = () => {
    if (!supportsSpeechRecognition || isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setIsListening(true);
    setError('');

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleTranslate(transcript);
    };
    recognition.onerror = () => {
      setError('语音输入刚刚没听清，再试一次。');
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const renderSpeakButton = (text, id) => (
    <button type="button" className="icon-button speak-button" onClick={() => speakEnglish(text, id)} aria-label="朗读英文原文">
      {speakingId === id ? '⏸' : '🔊'}
    </button>
  );

  return (
    <div className="module">
      <div className="fragment-layout">
        <div className="fragment-left">
          <div className="input-card">
            <label htmlFor="fragment-input">今天捡到什么英语碎片？</label>
            <div className="input-with-action">
              <textarea
                id="fragment-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="比如：I’m down for whatever."
                rows="4"
              />
              <button
                type="button"
                className={`icon-button mic-button ${isListening ? 'listening' : ''}`}
                onClick={startVoiceInput}
                disabled={!supportsSpeechRecognition || status === 'loading'}
                title={!supportsSpeechRecognition ? '当前浏览器不支持语音输入，建议使用 Chrome' : '语音输入'}
                aria-label="语音输入"
              >
                🎤
              </button>
            </div>
            <button type="button" className="primary-button" onClick={handleTranslate} disabled={!input.trim() || status === 'loading'}>
              {status === 'loading' ? '翻译中...' : '翻译'}
            </button>
            {notice && <p className="soft-success">{notice}</p>}
            {error && <p className="soft-error">{error}</p>}
          </div>
        </div>

        <section className="list-section fragment-library-pane">
          <h2>碎片词库</h2>
          {fragments.length === 0 ? (
            <div className="empty-state">还没有碎片～去看个vlog，把听不懂的发过来吧 ✨</div>
          ) : (
            <div className="card-list">
              {fragments.map((item) => (
                <article className="library-card" key={item.id}>
                  <div className="library-card-main">
                    <div className="library-card-toolbar">
                      <button type="button" className="mini-icon-button" onClick={() => startEditing(item)} aria-label="编辑碎片">
                        ✎
                      </button>
                      <button type="button" className="mini-icon-button danger" onClick={() => setDeleteConfirmId(item.id)} aria-label="删除碎片">
                        ×
                      </button>
                    </div>

                    {editingId === item.id ? (
                      <div className="fragment-edit-box">
                        <textarea value={editingSource} onChange={(event) => setEditingSource(event.target.value)} rows="3" />
                        <div className="inline-actions">
                          <button type="button" className="secondary-button compact-button" onClick={cancelEditing}>
                            先不改
                          </button>
                          <button type="button" className="primary-button compact-button" onClick={() => saveEdit(item)} disabled={!editingSource.trim() || status === 'loading'}>
                            {status === 'loading' ? '重译中...' : '重新整理'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="source-row">
                          <h3>{item.source}</h3>
                          {renderSpeakButton(item.source, `fragment-${item.id}`)}
                        </div>
                        <p className="translation">{item.translation}</p>
                        <p>{item.scene}</p>
                        {item.better && (
                          <div className="better-row">
                            <p className="better">更地道：{item.better}</p>
                            <button type="button" className="collect-chip" onClick={() => collectBetter(item.better)}>
                              收录
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {deleteConfirmId === item.id && (
                      <div className="soft-confirm">
                        <span>这条不留啦？</span>
                        <button type="button" onClick={() => confirmDelete(item.id)}>
                          删除
                        </button>
                        <button type="button" onClick={() => setDeleteConfirmId('')}>
                          留着
                        </button>
                      </div>
                    )}

                    <div className="card-meta">
                      <time>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time>
                      {item.updatedAt && item.updatedAt !== item.createdAt && <span>改过</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
