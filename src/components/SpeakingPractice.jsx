import { useEffect, useRef, useState } from 'react';
import { askDeepSeek } from '../services/deepseek.js';
import { APP_STATE_SYNCED_EVENT, addVocabEntry, clearSpeakingState, getSpeakingState, saveSpeakingState } from '../utils/storage.js';

const sceneConfigs = [
  {
    label: '☕ 咖啡厅点单',
    tasks: [
      {
        prompt: '和邻座搭讪，聊聊各自在做什么',
        context: 'strike up a conversation with someone sitting nearby',
        reversedPrompt: '你在咖啡厅专心工作，有人来和你搭讪，自然接话聊下去',
        reversedContext: "you're working at a café and someone approaches to start a conversation with you",
      },
      {
        prompt: '向咖啡师请教一款你没喝过的饮品',
        context: "ask the barista to recommend something you've never tried",
      },
      {
        prompt: '和朋友约好在这里见面，你先到了，用英文给他发消息催他',
        context: "you arrived first at the café, message your friend who's running late",
        reversedPrompt: '你迟到了去见在咖啡厅等你的朋友，需要道歉并解释',
        reversedContext: "you're late to meet a friend at the café, need to apologize and explain yourself",
      },
      {
        prompt: '点单时发现菜单上有你不认识的东西，试着问清楚再点',
        context: 'ordering something unfamiliar from the menu',
      },
      {
        prompt: '你在这里远程办公，需要找人借一下充电器',
        context: "you're working remotely and need to borrow a charger",
        reversedPrompt: '你在咖啡厅，有陌生人来向你借充电器，用英文回应',
        reversedContext: "you're at a café and a stranger approaches asking to borrow your charger",
      },
    ],
  },
  {
    label: '🏢 职场会议',
    tasks: [
      {
        prompt: '和同事讨论一个项目的截止日期要延期',
        context: 'discuss pushing back a project deadline with a colleague',
        reversedPrompt: '同事告知你负责的项目要延期，你需要回应并协商新的时间节点',
        reversedContext: 'a colleague informs you that a shared project needs to be delayed, respond and negotiate a new timeline',
      },
      {
        prompt: '向上级汇报本周进展，需要提到一个遇到的阻碍',
        context: "weekly update to your manager, including a blocker you've hit",
        reversedPrompt: '你是上级，正在听下属汇报本周进展，需要提问并给出反馈',
        reversedContext: "you're the manager listening to a team member's weekly update, ask questions and give feedback",
      },
      {
        prompt: '给新来的同事解释你们团队的工作流程',
        context: 'explain the team workflow to a new colleague',
        reversedPrompt: '你是新同事，正在听老员工介绍团队流程，边听边提问',
        reversedContext: "you're the new colleague being walked through the team workflow, listen and ask questions",
      },
      {
        prompt: '会议中有人提出了一个你不同意的方案，试着礼貌地表达不同意见',
        context: 'politely push back on a proposal you disagree with in a meeting',
        reversedPrompt: '你在会议中提出了一个方案，有同事表示不同意，你需要回应讨论',
        reversedContext: 'you proposed an idea in a meeting and a colleague is pushing back, respond and discuss',
      },
      {
        prompt: '跨部门合作中，你需要向对方要一份他们还没给你的资料',
        context: "follow up with another team for materials they haven't sent yet",
        reversedPrompt: '你是被催的那方，对方来要一份你还没准备好的资料，需要解释进度并给出承诺',
        reversedContext: "you're being followed up on for materials you haven't sent yet, explain the delay and commit to a timeline",
      },
    ],
  },
  {
    label: '✈️ 旅行途中',
    tasks: [
      {
        prompt: '你在机场，登机口临时更换了，需要向工作人员确认',
        context: 'your gate changed at the airport, confirm with staff',
      },
      {
        prompt: '你住进酒店，发现房间里空调坏了，去前台反映',
        context: 'report a broken AC in your hotel room at the front desk',
      },
      {
        prompt: '在陌生城市问路，需要找到最近的地铁站',
        context: 'ask for directions to the nearest subway station in an unfamiliar city',
        reversedPrompt: '你是当地人，一个外国游客来向你问地铁站怎么走，用英文帮他指路',
        reversedContext: "you're a local and a foreign tourist asks you for directions to the nearest subway station",
      },
      {
        prompt: '在景点排队，和旁边的外国游客聊起来了',
        context: 'chat with a foreign tourist while waiting in line at an attraction',
      },
      {
        prompt: '餐厅上错菜了，你需要告知服务员并重新点',
        context: 'wrong dish was served, inform the waiter and reorder',
      },
    ],
  },
  {
    label: '🛍️ 购物闲聊',
    tasks: [
      {
        prompt: '你想买一件衣服，但不确定尺码，向店员求助',
        context: 'ask a store assistant for help finding your size',
      },
      {
        prompt: '买了东西回家发现有质量问题，回店里要求退换',
        context: 'return or exchange an item with a quality issue',
        reversedPrompt: '你是店员，有顾客拿着有质量问题的商品来要求退换，需要妥善处理',
        reversedContext: "you're a store assistant handling a customer who wants to return or exchange a defective item",
      },
      {
        prompt: '在超市找不到某样东西，问工作人员在哪个货架',
        context: 'ask a supermarket staff member where to find a specific item',
      },
      {
        prompt: '你在逛街，有店员一直跟着你，试着礼貌地说你只是看看',
        context: "politely let a pushy sales assistant know you're just browsing",
        reversedPrompt: '你是店员，需要照顾到顾客但又不过度打扰，礼貌地回应顾客说只是看看',
        reversedContext: "you're a sales assistant whose customer says they're just browsing, respond politely without being pushy",
      },
      {
        prompt: '你想买的东西没有你想要的颜色，问问有没有其他选择或能否预订',
        context: 'ask if a different color or backorder option is available',
      },
    ],
  },
];

function pickRandomTask(scene) {
  const config = sceneConfigs.find((item) => item.label === scene);
  if (!config?.tasks.length) return null;
  return config.tasks[Math.floor(Math.random() * config.tasks.length)];
}

function hydrateTask(task) {
  if (!task) return null;
  return sceneConfigs.flatMap((config) => config.tasks).find((item) => item.prompt === task.prompt && item.context === task.context) || task;
}

function canReverseTask(task) {
  return Boolean(task?.reversedPrompt && task?.reversedContext);
}

function getTaskView(task, isReversed) {
  if (!task) return null;
  if (!isReversed || !canReverseTask(task)) return { prompt: task.prompt, context: task.context };
  return { prompt: task.reversedPrompt, context: task.reversedContext };
}

function buildSystemPrompt(scene, task) {
  const taskInstruction = task?.context
    ? `User's optional scenario task: ${task.context}. Treat this as the user's goal. Never speak as the user or complete the user's task for them. Play the natural counterpart or conversation partner in the scene, and open with a line that invites the user into this situation. If the user talks about something else, follow their lead naturally.`
    : '';

  return `You are a conversation partner helping a Chinese user practice English speaking. 
Start the conversation naturally based on the scene: ${scene}.
${taskInstruction}
Always reply in English.
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
  const [currentTask, setCurrentTask] = useState(hydrateTask(savedSpeakingState.currentTask));
  const [isTaskReversed, setIsTaskReversed] = useState(savedSpeakingState.isTaskReversed || false);
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
  const activeTask = getTaskView(currentTask, isTaskReversed);
  const canSwitchTaskSide = canReverseTask(currentTask);

  useEffect(() => {
    const refreshSpeakingState = () => {
      const nextState = getSpeakingState();
      setScene(nextState.scene || '');
      setCurrentTask(hydrateTask(nextState.currentTask));
      setIsTaskReversed(nextState.isTaskReversed || false);
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
    saveSpeakingState({ scene, currentTask, isTaskReversed, messages, summary });
  }, [scene, currentTask, isTaskReversed, messages, summary]);

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

  const generateOpening = async (selectedScene, taskView) => {
    const opening = await askDeepSeek([
      { role: 'system', content: buildSystemPrompt(selectedScene, taskView) },
      { role: 'user', content: `Please start the conversation as the user's counterpart in this scene. User's optional task: ${taskView?.context || selectedScene}.` },
    ]);
    setMessages([{ role: 'assistant', content: opening, id: crypto.randomUUID() }]);
  };

  const startScene = async (selectedScene) => {
    const selectedTask = pickRandomTask(selectedScene);
    const selectedTaskView = getTaskView(selectedTask, false);
    setScene(selectedScene);
    setCurrentTask(selectedTask);
    setIsTaskReversed(false);
    setMessages([]);
    setSummary('');
    setInput('');
    setError('');
    setSpeakingId('');
    speakingIdRef.current = '';
    window.speechSynthesis?.cancel();
    setStatus('loading');

    try {
      await generateOpening(selectedScene, selectedTaskView);
    } catch {
      setError('开场白卡住了，换个场景再试试。');
    } finally {
      setStatus('idle');
    }
  };

  const switchTaskSide = async () => {
    if (!scene || !canSwitchTaskSide || status === 'loading') return;

    const nextIsReversed = !isTaskReversed;
    const nextTaskView = getTaskView(currentTask, nextIsReversed);
    setIsTaskReversed(nextIsReversed);
    setMessages([]);
    setSummary('');
    setInput('');
    setError('');
    setSpeakingId('');
    speakingIdRef.current = '';
    window.speechSynthesis?.cancel();
    setStatus('loading');

    try {
      await generateOpening(scene, nextTaskView);
    } catch {
      setError('换边开场白卡住了，再点一次试试。');
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
        { role: 'system', content: buildSystemPrompt(scene, activeTask) },
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
    setCurrentTask(null);
    setIsTaskReversed(false);
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
            {sceneConfigs.map((item) => (
              <button key={item.label} type="button" className="scene-button" onClick={() => startScene(item.label)} disabled={status === 'loading'}>
                {item.label}
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
      {activeTask && (
        <div className="today-task">
          <span>🎯 今日任务：{activeTask.prompt}</span>
          {canSwitchTaskSide && (
            <button type="button" className="task-side-button" onClick={switchTaskSide} disabled={status === 'loading'}>
              {isTaskReversed ? '换回来' : '🔄 换边'}
            </button>
          )}
        </div>
      )}

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
