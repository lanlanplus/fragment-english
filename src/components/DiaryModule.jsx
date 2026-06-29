import { useEffect, useRef, useState } from 'react';
import { askDeepSeek, parseJsonResponse } from '../services/deepseek.js';
import { APP_STATE_SYNCED_EVENT, getDiaries, saveDiary } from '../utils/storage.js';

const diarySystemPrompt = `You are an English writing assistant helping a Chinese learner improve their English diary entries.

Rules:
1. ONLY improve the English language quality (grammar, naturalness, word choice)
2. NEVER comment on, judge, or respond to the content/emotions expressed
3. Keep the same meaning and personal voice
4. Return ONLY a JSON object, no extra text:
{
  "polished": "the improved English version",
  "tips": [
    "原句：xxx → 更自然：xxx（一句话说明为什么）",
    "原句：xxx → 更自然：xxx（一句话说明为什么）"
  ]
}
Return 2-3 tips maximum. If the writing is already good, return 1 tip or an empty array.`;

function getTodayInfo() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;
  const datePart = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
  return {
    date,
    dateDisplay: `${datePart} · ${weekday}`,
  };
}

function createDiaryEntry({ original, polished = null, tips = [], isDraft }) {
  const { date, dateDisplay } = getTodayInfo();
  const id = String(Date.now());
  return {
    id,
    date,
    dateDisplay,
    original,
    polished,
    tips,
    isDraft,
    createdAt: new Date().toISOString(),
  };
}

export default function DiaryModule() {
  const [input, setInput] = useState('');
  const [polished, setPolished] = useState('');
  const [tips, setTips] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedId, setExpandedId] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supportsSpeechRecognition = Boolean(SpeechRecognition);
  const todayInfo = getTodayInfo();

  useEffect(() => {
    setDiaries(getDiaries());

    const refreshSyncedDiaries = () => {
      setDiaries(getDiaries());
    };

    window.addEventListener(APP_STATE_SYNCED_EVENT, refreshSyncedDiaries);
    return () => window.removeEventListener(APP_STATE_SYNCED_EVENT, refreshSyncedDiaries);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const refreshDiaries = () => {
    setDiaries(getDiaries());
  };

  const clearResult = () => {
    setPolished('');
    setTips([]);
    setSavedMessage('');
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
      setInput(event.results[0][0].transcript);
      clearResult();
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

  const saveDraft = () => {
    const original = input.trim();
    if (!original) return;

    saveDiary(createDiaryEntry({ original, isDraft: true }));
    refreshDiaries();
    setSavedMessage('草稿已保存。');
  };

  const polishDiary = async () => {
    const original = input.trim();
    if (!original || status === 'loading') return;

    setStatus('loading');
    setError('');
    setSavedMessage('');

    try {
      const text = await askDeepSeek([
        { role: 'system', content: diarySystemPrompt },
        { role: 'user', content: original },
      ]);
      const result = parseJsonResponse(text);
      setPolished(result.polished || '');
      setTips(Array.isArray(result.tips) ? result.tips.slice(0, 3) : []);
      setStatus('success');
    } catch {
      setError('润色暂时没成功，再点一次试试。');
      setStatus('idle');
    }
  };

  const saveBothVersions = () => {
    const original = input.trim();
    if (!original || !polished) return;

    saveDiary(createDiaryEntry({ original, polished, tips, isDraft: false }));
    refreshDiaries();
    setInput('');
    clearResult();
    setStatus('idle');
    setSavedMessage('两个版本都保存好了。');
  };

  return (
    <div className="module diary-module">
      <section className="diary-history">
        <button type="button" className="diary-history-toggle" onClick={() => setIsHistoryOpen((current) => !current)}>
          <span>我的日记</span>
          <span aria-hidden="true">{isHistoryOpen ? '收起' : '展开'}</span>
        </button>

        {isHistoryOpen && (
          <div className="card-list">
            {diaries.length === 0 ? (
              <div className="empty-state">还没有日记，今天可以先写一句。</div>
            ) : (
              diaries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                return (
                  <article className="library-card diary-entry-card" key={entry.id}>
                    <button type="button" className="diary-entry-preview" onClick={() => setExpandedId(isExpanded ? '' : entry.id)}>
                      <span>
                        <strong>{entry.dateDisplay}</strong>
                        <small>{entry.original.slice(0, 30)}{entry.original.length > 30 ? '...' : ''}</small>
                      </span>
                      {entry.isDraft && <span className="draft-tag">草稿</span>}
                    </button>

                    {isExpanded && (
                      <div className="diary-entry-detail">
                        <div>
                          <p className="card-kicker">我写的</p>
                          <p>{entry.original}</p>
                        </div>
                        {entry.polished && (
                          <div>
                            <p className="card-kicker">润色版</p>
                            <p>{entry.polished}</p>
                          </div>
                        )}
                        {entry.tips?.length > 0 && (
                          <div>
                            <p className="card-kicker">表达提示</p>
                            <ul className="diary-tip-list">
                              {entry.tips.map((tip) => (
                                <li key={tip}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>

      <section className="diary-writer">
        <p className="card-kicker">{todayInfo.dateDisplay}</p>
        <div className="diary-textarea-wrap">
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              clearResult();
            }}
            placeholder="用英文写点什么，哪怕一句话也好 ✨"
            rows="7"
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
      </section>

      {polished && (
        <section className="diary-result">
          <div>
            <h2>✨ 润色版本</h2>
            <p>{polished}</p>
          </div>
          <div>
            <h2>💡 表达提示</h2>
            {tips.length === 0 ? (
              <p className="diary-tip">这段已经很自然，可以直接保存。</p>
            ) : (
              <ul className="diary-tip-list">
                {tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {polished ? (
        <button type="button" className="primary-button diary-save-all" onClick={saveBothVersions} disabled={!input.trim() || status === 'loading'}>
          保存两个版本
        </button>
      ) : (
        <div className="diary-actions">
          <button type="button" className="secondary-button" onClick={saveDraft} disabled={!input.trim() || status === 'loading'}>
            保存草稿
          </button>
          <button type="button" className="primary-button" onClick={polishDiary} disabled={!input.trim() || status === 'loading'}>
            {status === 'loading' ? '润色中...' : '润色 ✨'}
          </button>
        </div>
      )}

      {savedMessage && <p className="soft-success">{savedMessage}</p>}
      {error && <p className="soft-error">{error}</p>}
    </div>
  );
}
