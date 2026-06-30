import { useEffect, useRef, useState } from 'react';
import { askDeepSeek } from '../services/deepseek.js';
import { APP_STATE_SYNCED_EVENT, addVocabEntry, clearSpeakingState, getSpeakingState, saveSpeakingState } from '../utils/storage.js';

const scenes = ['☕ 咖啡厅点单', '🏢 职场会议', '✈️ 旅行途中', '🛍️ 购物闲聊'];

function buildSystemPrompt(scene) {
  return `You are a conversation partner helping a Chinese user practice English speaking. 
Start the conversation naturally based on the scene: ${scene}.
Keep your messages short (1-2 sentences). Stay in character throughout.
After each of your replies, add a new line with this exact format:
💡 You could also say: "[a more natural alternative expression for what the user just said]"
If it's your opening line, skip the 💡 tip.`;
}

function splitTip(text) {
  const [message, ...tipParts] = text.split('💡 You could also say:');
  return {
    message: message.trim(),
    tip: tipParts.length ? `💡 You could also say:${tipParts.join('💡 You could also say:')}`.trim() : '',
  };
}

export default function SpeakingPractice() {
  const savedSpeakingState = getSpeakingState();
  const [scene, setScene] = useState(savedSpeakingState.scene || '');
  const [messages, setMessages] = useState(savedSpeakingState.messages || []);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [summary, setSummary] = useState(savedSpeakingState.summary || '');
  const [error, setError] = useState('');
  const [collectDraft, setCollectDraft] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [speakingId, setSpeakingId] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const speakingIdRef = useRef('');

  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supportsSpeechRecognition = Boolean(SpeechRecognition);

  const userTurns = messages.filter((message) => message.role === 'user').length;
  const canFinish = userTurns >= 5 && !summary;

  useEffect(() => {
    const refreshSpeakingState = () => {
      const nextState = getSpeakingState();
      setScene(nextState.scene || '');
      setMessages(nextState.messages || []);
      setSummary(nextState.summary || '');
    };

    window.addEventListener(APP_STATE_SYNCED_EVENT, refreshSpeakingState);
    return () => {
      window.removeEventListener(APP_STATE_SYNCED_EVENT, refreshSpeakingState);
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    saveSpeakingState({ scene, messages, summary });
  }, [scene, messages, summary]);

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

  const startScene = async (selectedScene) => {
    setScene(selectedScene);
    setMessages([]);
    setSummary('');
    setError('');
    setStatus('loading');

    try {
      const opening = await askDeepSeek([
        { role: 'system', content: buildSystemPrompt(selectedScene) },
        { role: 'user', content: 'Please start the conversation.' },
      ]);
      setMessages([{ role: 'assistant', content: opening, id: crypto.randomUUID() }]);
    } catch {
      setError('开场白卡住了，换个场景再试试。');
    } finally {
      setStatus('idle');
    }
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || status === 'loading') return;

    const userMessage = { role: 'user', content, id: crypto.randomUUID() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setSpeakingId('');
    window.speechSynthesis?.cancel();
    setStatus('loading');
    setError('');

    try {
      const reply = await askDeepSeek([
        { role: 'system', content: buildSystemPrompt(scene) },
        ...nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
      ]);
      setMessages([...nextMessages, { role: 'assistant', content: reply, id: crypto.randomUUID() }]);
    } catch {
      setError('AI 刚才没接住这句话，再发一次也可以。');
    } finally {
      setStatus('idle');
    }
  };

  const finishConversation = async () => {
    setStatus('loading');
    setError('');

    const transcript = messages.map((message) => `${message.role}: ${message.content}`).join('\n');

    try {
      const text = await askDeepSeek([
        {
          role: 'user',
          content: `请用中文简短总结这段对话练习（2-3句），格式：
你今天用得很自然的表达是「XXX」。下次可以试试「XXX」，听起来会更地道。继续加油！

对话如下：
${transcript}`,
        },
      ]);
      setSummary(text);
    } catch {
      setError('总结暂时没生成出来，可以稍后再点一次。');
    } finally {
      setStatus('idle');
    }
  };

  const reset = () => {
    setScene('');
    setMessages([]);
    setInput('');
    setSummary('');
    setError('');
    setCollectDraft(null);
    setSavedMessage('');
    setSpeakingId('');
    speakingIdRef.current = '';
    setIsListening(false);
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
    setStatus('idle');
    clearSpeakingState();
  };

  const getSelectedText = (container) => {
    const selection = window.getSelection?.();
    const selectedText = selection?.toString().trim();
    if (!selectedText || !selection.rangeCount) return '';

    const range = selection.getRangeAt(0);
    return container.contains(range.commonAncestorContainer) ? selectedText : '';
  };

  const openCollector = (text, sourceLabel) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    setCollectDraft({ text: cleanText, sourceLabel });
    setSavedMessage('');
  };

  const handleCollectableMouseUp = (event, fallbackText, sourceLabel) => {
    const container = event.currentTarget;
    window.setTimeout(() => {
      const selectedText = getSelectedText(container);
      if (selectedText) openCollector(selectedText, sourceLabel);
    }, 0);
  };

  const handleCollectableClick = (event, fallbackText, sourceLabel) => {
    if (event.target.closest?.('button')) return;
    const selectedText = getSelectedText(event.currentTarget);
    if (!selectedText) openCollector(fallbackText, sourceLabel);
  };

  const saveCollectDraft = () => {
    if (!collectDraft?.text) return;
    addVocabEntry(collectDraft);
    setCollectDraft(null);
    window.getSelection?.().removeAllRanges();
    setSavedMessage('收进词库啦。');
  };

  if (!scene) {
    return (
      <div className="module">
        <section className="scene-picker">
          <h2>想去哪儿开口？</h2>
          <p>选一个小场景，像聊天一样练起来。</p>
          <div className="scene-grid">
            {scenes.map((item) => (
              <button key={item} type="button" className="scene-button" onClick={() => startScene(item)} disabled={status === 'loading'}>
                {item}
              </button>
            ))}
          </div>
        </section>
        {status === 'loading' && <div className="empty-state">正在布置场景...</div>}
        {error && <p className="soft-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="module speaking-module">
      <header className="conversation-top">
        <button type="button" className="ghost-button" onClick={reset}>
          换场景
        </button>
        <span>{scene}</span>
      </header>

      <section className="chat-list" aria-live="polite">
        {messages.map((message) => {
          const { message: bubbleText, tip } = message.role === 'assistant' ? splitTip(message.content) : { message: message.content, tip: '' };
          return (
            <article key={message.id} className={`chat-row ${message.role}`}>
              <div className="chat-bubble">
                <span
                  className={message.role === 'assistant' ? 'collectable-text' : ''}
                  onMouseUp={message.role === 'assistant' ? (event) => handleCollectableMouseUp(event, bubbleText, '来自口语对话') : undefined}
                  onClick={message.role === 'assistant' ? (event) => handleCollectableClick(event, bubbleText, '来自口语对话') : undefined}
                >
                  {bubbleText}
                </span>
                {message.role === 'assistant' && (
                  <button type="button" className="icon-button speak-button bubble-speak-button" onClick={() => speakEnglish(bubbleText, message.id)} aria-label="朗读 AI 回复">
                    {speakingId === message.id ? '⏸' : '🔊'}
                  </button>
                )}
              </div>
              {tip && (
                <div className="tip-row">
                  <p className="tip-text">{tip}</p>
                  <button type="button" className="collect-chip" onClick={() => openCollector(tip, '来自口语对话-地道表达')}>
                    收录
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {status === 'loading' && <div className="typing-dot">thinking...</div>}
      </section>

      {summary ? (
        <section className="summary-card">
          <h2>本轮小结</h2>
          <p>{summary}</p>
          <button type="button" className="primary-button" onClick={reset}>
            再来一轮
          </button>
        </section>
      ) : (
        <>
          {canFinish && (
            <button type="button" className="finish-button" onClick={finishConversation} disabled={status === 'loading'}>
              结束对话
            </button>
          )}
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="用英文回一句..."
              disabled={status === 'loading'}
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
            <button type="submit" disabled={!input.trim() || status === 'loading'}>
              发送
            </button>
          </form>
        </>
      )}
      {collectDraft && (
        <div className="collect-popover">
          <p>{collectDraft.text}</p>
          <small>{collectDraft.sourceLabel}</small>
          <div className="inline-actions">
            <button type="button" className="secondary-button compact-button" onClick={() => setCollectDraft(null)}>
              先看看
            </button>
            <button type="button" className="primary-button compact-button" onClick={saveCollectDraft}>
              收录
            </button>
          </div>
        </div>
      )}
      {savedMessage && <p className="soft-success">{savedMessage}</p>}
      {error && <p className="soft-error">{error}</p>}
    </div>
  );
}
