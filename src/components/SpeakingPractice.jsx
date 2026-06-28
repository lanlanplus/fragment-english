import { useState } from 'react';
import { askDeepSeek } from '../services/deepseek.js';

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
  const [scene, setScene] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');

  const userTurns = messages.filter((message) => message.role === 'user').length;
  const canFinish = userTurns >= 5 && !summary;

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
    setStatus('idle');
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
              <div className="chat-bubble">{bubbleText}</div>
              {tip && <p className="tip-text">{tip}</p>}
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
            <button type="submit" disabled={!input.trim() || status === 'loading'}>
              发送
            </button>
          </form>
        </>
      )}
      {error && <p className="soft-error">{error}</p>}
    </div>
  );
}
