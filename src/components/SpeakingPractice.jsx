import { useEffect, useRef, useState } from 'react';
import { askDeepSeek } from '../services/deepseek.js';
import {
  APP_STATE_SYNCED_EVENT,
  addSpeakingHistory,
  addVocabEntry,
  clearSpeakingState,
  getSpeakingHistory,
  getSpeakingState,
  saveSpeakingState,
} from '../utils/storage.js';

const regularSceneConfigs = [
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

const textbookSceneConfigs = [
  {
    label: '📞 电话沟通',
    unitRange: 'Unit 47-50',
    tasks: [
      {
        number: 1,
        prompt: '打电话找人，对方不在',
        context: 'call an office and ask to speak to someone, but they are not available',
        unit: 'Unit 48',
        source: 'Asking to speak to someone',
        openingHint: 'This scene connects to Unit 48: Asking to speak to someone. Start by asking for the person you need.',
        reversedPrompt: '你接到电话，对方要找的同事不在，需要礼貌说明并提供帮助',
        reversedContext: 'answer a business call and explain that the requested person is not available, then offer to help',
      },
      {
        number: 2,
        prompt: '语音信箱留言',
        context: 'leave a concise voicemail with your name, reason for calling, and callback details',
        unit: 'Unit 48',
        source: 'Voicemail',
        openingHint: 'This scene connects to Unit 48: Voicemail. Practise leaving a clear message after the tone.',
      },
      {
        number: 3,
        prompt: '接听并记录留言信息',
        context: 'take a phone message for a colleague, checking the caller name, number, and reason',
        unit: 'Unit 49',
        source: 'Giving and taking messages',
        openingHint: 'This scene connects to Unit 49: Giving and taking messages. Ask for the key details and confirm them.',
        reversedPrompt: '你打电话给某位联系人，对方不在，需要请接线人帮你留言',
        reversedContext: 'call for someone who is unavailable and ask the person answering to take a message',
      },
      {
        number: 4,
        prompt: '电话核对拼写/信息',
        context: 'check the spelling of a name and confirm contact information clearly on the phone',
        unit: 'Unit 49',
        source: 'Spelling names, checking info',
        openingHint: 'This scene connects to Unit 49: Spelling names and checking information. Practise confirming details carefully.',
        reversedPrompt: '你在电话中提供姓名和联系方式，并配合对方核对拼写与信息',
        reversedContext: 'give your name and contact details over the phone while the other person checks the spelling and information',
      },
      {
        number: 5,
        prompt: '电话预约并临时改约',
        context: 'make an appointment by phone, then negotiate a change because something urgent came up',
        unit: 'Unit 50',
        source: 'Making/changing arrangements',
        openingHint: 'This scene connects to Unit 50: Making and changing arrangements. Set a time, then handle a change politely.',
        reversedPrompt: '对方来电预约并临时改约，你需要协调时间并确认最终安排',
        reversedContext: 'handle a phone call where the other person makes and then changes an appointment, coordinating the final time',
      },
    ],
  },
  {
    label: '🧑‍💼 会议参与',
    unitRange: 'Unit 55-59',
    tasks: [
      {
        number: 6,
        prompt: '开场并说明会议类型/目的',
        context: 'open a meeting by explaining the meeting type, purpose, and expected outcome',
        unit: 'Unit 55',
        source: 'Types of meeting',
        openingHint: 'This scene connects to Unit 55: Types of meeting. Open by saying what kind of meeting this is and why everyone is here.',
      },
      {
        number: 7,
        prompt: '作为主持人开场、控场',
        context: 'chair a meeting, welcome participants, set the agenda, and keep the discussion moving',
        unit: 'Unit 56',
        source: 'The role of the chair',
        openingHint: 'This scene connects to Unit 56: The role of the chair. Practise opening and guiding the meeting.',
      },
      {
        number: 8,
        prompt: '表达自己的观点',
        context: 'give your opinion in a meeting and invite a colleague to respond',
        unit: 'Unit 57',
        source: 'Asking for/expressing opinions',
        openingHint: 'This scene connects to Unit 57: Asking for and expressing opinions. Share your view and ask what others think.',
        reversedPrompt: '你在会议中被问到观点，需要先询问背景再清楚表达看法',
        reversedContext: 'respond when someone asks for your opinion in a meeting, asking for context and then expressing your view clearly',
      },
      {
        number: 9,
        prompt: '对他人观点表示赞成',
        context: 'respond to a colleague by agreeing with their point and adding a supporting reason',
        unit: 'Unit 58',
        source: 'Agreeing',
        openingHint: 'This scene connects to Unit 58: Agreeing. Practise agreeing naturally and adding a reason.',
        reversedPrompt: '你提出一个观点，对方会表示赞成并补充理由，你需要继续推进讨论',
        reversedContext: 'present an idea in a meeting and respond as another person agrees and adds a reason',
      },
      {
        number: 10,
        prompt: '礼貌地表达不同意见',
        context: 'politely disagree with a proposal in a meeting and explain your concern',
        unit: 'Unit 58',
        source: 'Disagreeing',
        openingHint: 'This scene connects to Unit 58: Disagreeing. Practise softening disagreement and explaining your concern.',
        reversedPrompt: '你提出方案后被同事礼貌反对，需要回应并继续讨论',
        reversedContext: 'respond to a colleague who politely disagrees with your proposal in a meeting',
      },
      {
        number: 11,
        prompt: '打断发言/请求澄清',
        context: 'interrupt politely during a meeting to check understanding and ask for clarification',
        unit: 'Unit 59',
        source: 'Interrupting, checking understanding',
        openingHint: 'This scene connects to Unit 59: Interrupting and checking understanding. Practise cutting in politely to clarify.',
        reversedPrompt: '你正在说明方案，对方打断并请求澄清，你需要解释得更清楚',
        reversedContext: 'explain a proposal while another participant interrupts politely to check understanding',
      },
      {
        number: 12,
        prompt: '总结会议结论',
        context: 'summarize the main decisions, action items, owners, and next steps at the end of a meeting',
        unit: 'Unit 59',
        source: 'Concluding',
        openingHint: 'This scene connects to Unit 59: Concluding. Practise wrapping up decisions and next steps.',
      },
    ],
  },
  {
    label: '🤝 商务谈判',
    unitRange: 'Unit 63-66',
    tasks: [
      {
        number: 13,
        prompt: '谈判开场、说明立场',
        context: 'open a negotiation by setting a constructive tone and explaining your position',
        unit: 'Unit 64',
        source: 'Opening the negotiation',
        openingHint: 'This scene connects to Unit 64: Opening the negotiation. Set the tone and state your position.',
        reversedPrompt: '你代表另一方参加谈判，需要回应开场并说明自己的立场',
        reversedContext: 'join a negotiation as the other side, respond to the opening, and explain your position',
      },
      {
        number: 14,
        prompt: '讨价还价',
        context: 'bargain over price, quantity, or delivery terms while keeping the tone professional',
        unit: 'Unit 63',
        source: 'Bargaining',
        openingHint: 'This scene connects to Unit 63: Bargaining. Practise negotiating price or terms professionally.',
        reversedPrompt: '你是报价方，客户正在讨价还价，你需要守住条件并适当回应',
        reversedContext: 'respond as the seller or supplier while the buyer bargains over price or terms',
      },
      {
        number: 15,
        prompt: '提出条件交换（让步）',
        context: 'offer a concession only if the other side agrees to a trade-off',
        unit: 'Unit 65',
        source: 'Concessions and trade-offs',
        openingHint: 'This scene connects to Unit 65: Concessions and trade-offs. Practise if-you-can-we-can language.',
        reversedPrompt: '对方提出有条件让步，你需要评估交换条件并回应',
        reversedContext: 'respond to a conditional concession and decide whether the proposed trade-off works',
      },
      {
        number: 16,
        prompt: '陷入僵局、寻求折中',
        context: 'handle a negotiation deadlock and suggest a compromise or mediator-style solution',
        unit: 'Unit 66',
        source: 'Deadlock and mediators',
        openingHint: 'This scene connects to Unit 66: Deadlock and mediators. Practise moving a stuck negotiation forward.',
        reversedPrompt: '谈判对方提出折中方案，你需要从己方利益出发继续协商',
        reversedContext: 'respond to a compromise proposal during a negotiation deadlock and continue negotiating from your side',
      },
      {
        number: 17,
        prompt: '确认协议细节',
        context: 'check the details of a deal before closing, including price, timing, responsibilities, and next steps',
        unit: 'Unit 66',
        source: 'Checking the deal',
        openingHint: 'This scene connects to Unit 66: Checking the deal. Practise confirming the agreement before closing.',
      },
    ],
  },
  {
    label: '💼 求职面试',
    unitRange: 'Unit 1, 3, 7',
    tasks: [
      {
        number: 18,
        prompt: '自我介绍：“What do you do?”',
        context: 'answer "What do you do?" with a natural description of your job, responsibilities, and workplace',
        unit: 'Unit 1',
        source: 'What do you do?',
        openingHint: 'This scene connects to Unit 1: What do you do? Practise describing your work naturally.',
      },
      {
        number: 19,
        prompt: '模拟面试问答',
        context: 'answer interview questions about your experience, strengths, and fit for the role',
        unit: 'Unit 3',
        source: 'Selection procedures',
        openingHint: 'This scene connects to Unit 3: Selection procedures. Practise a short interview exchange.',
        reversedPrompt: '你作为面试官，向候选人提问并追问经历、优势和岗位匹配度',
        reversedContext: 'act as the interviewer, asking a candidate about experience, strengths, and fit for the role',
      },
      {
        number: 20,
        prompt: '聊职业规划、跳槽原因',
        context: 'explain your career path, future goals, and reasons for leaving a company in a positive way',
        unit: 'Unit 7',
        source: 'Career paths, Leaving a company',
        openingHint: 'This scene connects to Unit 7: Career paths and leaving a company. Practise explaining career moves positively.',
      },
    ],
  },
  {
    label: '🌿 职场软技能闲聊',
    unitRange: 'Unit 41-44',
    tasks: [
      {
        number: 21,
        prompt: '讨论一个商业伦理案例',
        context: 'discuss a workplace business ethics case and explain what the company should do',
        unit: 'Unit 41',
        source: 'Social issues',
        openingHint: 'This scene connects to Unit 41: Social issues. Practise discussing an ethics case at work.',
      },
      {
        number: 22,
        prompt: '聊时间管理习惯',
        context: 'talk about your time management habits, deadlines, priorities, and practical time tips',
        unit: 'Unit 42',
        source: 'Timeframes, time tips',
        openingHint: 'This scene connects to Unit 42: Timeframes and time tips. Practise talking about how you manage time.',
      },
      {
        number: 23,
        prompt: '聊工作压力和应对方式',
        context: 'talk about workplace stress, warning signs, and healthy ways to manage pressure',
        unit: 'Unit 43',
        source: 'When stimulation turns to stress',
        openingHint: 'This scene connects to Unit 43: When stimulation turns to stress. Practise discussing pressure and coping strategies.',
      },
      {
        number: 24,
        prompt: '讨论你偏好的领导风格',
        context: 'discuss leadership and management styles, including what style helps you do your best work',
        unit: 'Unit 44',
        source: 'Leadership, management styles',
        openingHint: 'This scene connects to Unit 44: Leadership and management styles. Practise describing the leadership style you prefer.',
      },
    ],
  },
  {
    label: '🌏 跨文化沟通',
    unitRange: 'Unit 45-46',
    tasks: [
      {
        number: 25,
        prompt: '讨论文化差异对工作的影响',
        context: 'discuss how cultural differences, power distance, and communication expectations affect teamwork',
        unit: 'Unit 45',
        source: 'Cultures, Power and distance',
        openingHint: 'This scene connects to Unit 45: Cultures, power and distance. Practise discussing culture at work.',
      },
      {
        number: 26,
        prompt: '处理跨文化沟通中的误会',
        context: 'handle a misunderstanding in cross-cultural communication and repair the relationship politely',
        unit: 'Unit 46',
        source: 'Cross-cultural communication',
        openingHint: 'This scene connects to Unit 46: Cross-cultural communication. Practise clarifying and repairing a misunderstanding.',
      },
    ],
  },
  {
    label: '🏷️ 销售与议价',
    unitRange: 'Unit 19, 23, 25',
    tasks: [
      {
        number: 27,
        prompt: '向客户介绍产品/推销',
        context: 'introduce a product to a customer, highlight benefits, and respond to initial interest or hesitation',
        unit: 'Unit 25',
        source: 'Promotional activities',
        openingHint: 'This scene connects to Unit 25: Promotional activities. Practise presenting a product and its benefits.',
        reversedPrompt: '你作为客户听销售介绍产品，需要提问、表达顾虑并判断是否感兴趣',
        reversedContext: 'act as the customer listening to a product pitch, asking questions and raising concerns',
      },
      {
        number: 28,
        prompt: '就价格进行协商',
        context: 'negotiate pricing with a customer, including market position, budget, and possible discounts',
        unit: 'Unit 23',
        source: 'Pricing, mass markets and niches',
        openingHint: 'This scene connects to Unit 23: Pricing, mass markets and niches. Practise discussing price and value.',
        reversedPrompt: '你作为客户与销售协商价格，需要说明预算、比较选择并争取优惠',
        reversedContext: 'act as the customer negotiating price, explaining budget limits and asking for a better offer',
      },
    ],
  },
];

const sceneConfigs = [...regularSceneConfigs, ...textbookSceneConfigs];

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
  const base = {
    number: task.number,
    unit: task.unit,
    source: task.source,
    openingHint: task.openingHint,
  };
  if (!isReversed || !canReverseTask(task)) return { ...base, prompt: task.prompt, context: task.context };
  return { ...base, prompt: task.reversedPrompt, context: task.reversedContext };
}

function buildSystemPrompt(scene, task) {
  const taskInstruction = task?.context
    ? `User's optional scenario task: ${task.context}. Treat this as the user's goal. ${task.unit ? `This textbook practice corresponds to ${task.unit}${task.source ? `: ${task.source}` : ''}. In your opening, naturally mention this unit connection once, then start the role-play.` : ''} ${task.openingHint ? `Opening guidance: ${task.openingHint}` : ''} Never speak as the user or complete the user's task for them. Play the natural counterpart or conversation partner in the scene, and open with a line that invites the user into this situation. If the user talks about something else, follow their lead naturally.`
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

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getWeekStart(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day + 1);
  return start;
}

function getFirstAiMessage(record) {
  const content = record.messages?.find((message) => message.role === 'ai')?.content || '';
  return splitTip(content).message;
}

function getDurationText(record) {
  const startedAt = new Date(record.createdAt).getTime();
  const endedAt = new Date(record.endedAt).getTime();
  if (!startedAt || !endedAt || endedAt <= startedAt) return '约1分钟';
  return `约${Math.max(1, Math.ceil((endedAt - startedAt) / 60000))}分钟`;
}

export default function SpeakingPractice() {
  const savedSpeakingState = getSpeakingState();
  const [scene, setScene] = useState(savedSpeakingState.scene || '');
  const [currentTask, setCurrentTask] = useState(hydrateTask(savedSpeakingState.currentTask));
  const [isTaskReversed, setIsTaskReversed] = useState(savedSpeakingState.isTaskReversed || false);
  const [messages, setMessages] = useState(savedSpeakingState.messages || []);
  const [conversationStartedAt, setConversationStartedAt] = useState(savedSpeakingState.createdAt || '');
  const [history, setHistory] = useState(getSpeakingHistory());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState('');
  const [isTextbookModeOpen, setIsTextbookModeOpen] = useState(false);
  const [expandedTextbookPack, setExpandedTextbookPack] = useState(textbookSceneConfigs[0]?.label || '');
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
  const conversationRef = useRef(null);
  const savedConversationKeyRef = useRef('');

  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supportsSpeechRecognition = Boolean(SpeechRecognition);

  const userTurns = messages.filter((message) => message.role === 'user').length;
  const canFinish = userTurns >= 5 && !summary;
  const activeTask = getTaskView(currentTask, isTaskReversed);
  const canSwitchTaskSide = canReverseTask(currentTask);
  const latestRecord = history[0];
  const weekStart = getWeekStart();
  const weeklyCount = history.filter((record) => new Date(record.endedAt || record.createdAt) >= weekStart).length;

  const persistCurrentConversation = (shouldUpdateState = true) => {
    const snapshot = conversationRef.current;
    const userMessageCount = snapshot?.messages?.filter((message) => message.role === 'user').length || 0;
    if (!snapshot?.scene || !userMessageCount) return null;

    const endedAt = new Date().toISOString();
    const saveKey = `${snapshot.startedAt}-${snapshot.messages.length}-${userMessageCount}`;
    if (savedConversationKeyRef.current === saveKey) return null;
    savedConversationKeyRef.current = saveKey;

    const record = {
      id: crypto.randomUUID(),
      scene: snapshot.scene,
      task: snapshot.task || '',
      messages: snapshot.messages.map((message) => ({
        role: message.role === 'assistant' ? 'ai' : 'user',
        content: message.content,
        timestamp: message.timestamp || endedAt,
      })),
      roundCount: userMessageCount,
      createdAt: snapshot.startedAt || snapshot.messages[0]?.timestamp || endedAt,
      endedAt,
    };

    const nextHistory = addSpeakingHistory(record);
    if (shouldUpdateState) setHistory(nextHistory);
    return record;
  };

  useEffect(() => {
    const refreshSpeakingState = () => {
      const nextState = getSpeakingState();
      setScene(nextState.scene || '');
      setCurrentTask(hydrateTask(nextState.currentTask));
      setIsTaskReversed(nextState.isTaskReversed || false);
      setMessages(nextState.messages || []);
      setConversationStartedAt(nextState.createdAt || '');
      setSummary(nextState.summary || '');
      setHistory(getSpeakingHistory());
    };

    window.addEventListener(APP_STATE_SYNCED_EVENT, refreshSpeakingState);
    return () => {
      persistCurrentConversation(false);
      window.removeEventListener(APP_STATE_SYNCED_EVENT, refreshSpeakingState);
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    saveSpeakingState({ scene, currentTask, isTaskReversed, messages, summary, createdAt: conversationStartedAt });
  }, [scene, currentTask, isTaskReversed, messages, summary, conversationStartedAt]);

  useEffect(() => {
    conversationRef.current = {
      scene,
      task: activeTask?.prompt || '',
      messages,
      startedAt: conversationStartedAt,
    };
  }, [scene, activeTask, messages, conversationStartedAt]);

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
    setMessages([{ role: 'assistant', content: opening, id: crypto.randomUUID(), timestamp: new Date().toISOString() }]);
  };

  const startTask = async (selectedScene, selectedTask) => {
    const selectedTaskView = getTaskView(selectedTask, false);
    const startedAt = new Date().toISOString();
    savedConversationKeyRef.current = '';
    setScene(selectedScene);
    setCurrentTask(selectedTask);
    setIsTaskReversed(false);
    setConversationStartedAt(startedAt);
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

  const startScene = async (selectedScene) => {
    await startTask(selectedScene, pickRandomTask(selectedScene));
  };

  const switchTaskSide = async () => {
    if (!scene || !canSwitchTaskSide || status === 'loading') return;

    persistCurrentConversation();
    const nextIsReversed = !isTaskReversed;
    const nextTaskView = getTaskView(currentTask, nextIsReversed);
    const startedAt = new Date().toISOString();
    savedConversationKeyRef.current = '';
    setIsTaskReversed(nextIsReversed);
    setConversationStartedAt(startedAt);
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

    const userMessage = { role: 'user', content, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
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
      setMessages([...nextMessages, { role: 'assistant', content: reply, id: crypto.randomUUID(), timestamp: new Date().toISOString() }]);
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
    persistCurrentConversation();
    setScene('');
    setCurrentTask(null);
    setIsTaskReversed(false);
    setConversationStartedAt('');
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
          <section className="speaking-overview" aria-label="口语对话统计">
            <div className="speaking-stats-grid">
              <div className="speaking-stat-card">
                <span>累计对话次数</span>
                <strong>{history.length}</strong>
              </div>
              <div className="speaking-stat-card">
                <span>本周对话次数</span>
                <strong>{weeklyCount}</strong>
              </div>
            </div>

            {latestRecord ? (
              <article className="speaking-recent-card">
                <div className="history-card-top">
                  <span className="scene-badge">{latestRecord.scene}</span>
                  <time>{formatDateTime(latestRecord.endedAt)}</time>
                  <button type="button" className="history-link" onClick={() => setIsHistoryOpen((isOpen) => !isOpen)}>
                    {isHistoryOpen ? '收起' : '查看全部 →'}
                  </button>
                </div>
                <p className="history-task">{latestRecord.task || '自由对话'}</p>
                <p className="history-preview">{getFirstAiMessage(latestRecord)}</p>
              </article>
            ) : (
              <p className="speaking-history-empty">还没有对话记录，选一个场景开始吧</p>
            )}

            {isHistoryOpen && history.length > 0 && (
              <div className="speaking-history-list">
                {history.map((record) => {
                  const isExpanded = expandedHistoryId === record.id;
                  return (
                    <article key={record.id} className="speaking-history-card">
                      <button
                        type="button"
                        className="history-card-button"
                        onClick={() => setExpandedHistoryId(isExpanded ? '' : record.id)}
                        aria-expanded={isExpanded}
                      >
                        <div className="history-card-top">
                          <span className="scene-badge">{record.scene}</span>
                          <time>{formatDateTime(record.endedAt)}</time>
                        </div>
                        <p className="history-task">{record.task || '自由对话'}</p>
                        <p className="history-preview">{getFirstAiMessage(record)}</p>
                        <div className="history-meta">
                          <span>{record.roundCount} 轮对话</span>
                          <span>{getDurationText(record)}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="history-transcript">
                          {record.messages.map((message, index) => (
                            <article key={`${record.id}-${index}`} className={`chat-row readonly ${message.role === 'ai' ? 'assistant' : 'user'}`}>
                              <div className="chat-bubble">{message.role === 'ai' ? splitTip(message.content).message : message.content}</div>
                            </article>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <p className="scene-picker-prompt">再来一轮？</p>
          <div className="scene-grid">
            {regularSceneConfigs.map((item) => (
              <button key={item.label} type="button" className="scene-button" onClick={() => startScene(item.label)} disabled={status === 'loading'}>
                {item.label}
              </button>
            ))}
          </div>
          <section className="textbook-mode">
            <button
              type="button"
              className="textbook-entry-button"
              onClick={() => setIsTextbookModeOpen((isOpen) => !isOpen)}
              aria-expanded={isTextbookModeOpen}
            >
              <span>📖 教材同步练习</span>
              <small>{isTextbookModeOpen ? '收起 7 个场景包' : '展开 7 个场景包'}</small>
            </button>
            {isTextbookModeOpen && (
              <div className="textbook-pack-list">
                {textbookSceneConfigs.map((pack) => {
                  const isExpanded = expandedTextbookPack === pack.label;
                  return (
                    <article key={pack.label} className="textbook-pack">
                      <button
                        type="button"
                        className="textbook-pack-header"
                        onClick={() => setExpandedTextbookPack(isExpanded ? '' : pack.label)}
                        aria-expanded={isExpanded}
                      >
                        <span>{pack.label}</span>
                        <small>{pack.unitRange}</small>
                      </button>
                      {isExpanded && (
                        <div className="textbook-task-list">
                          {pack.tasks.map((task) => (
                            <button
                              key={`${pack.label}-${task.number}`}
                              type="button"
                              className="textbook-task-card"
                              onClick={() => startTask(pack.label, task)}
                              disabled={status === 'loading'}
                            >
                              <span className="textbook-task-title">{task.number}. {task.prompt}</span>
                              <span className="textbook-task-meta">
                                <span>{task.unit}</span>
                                {canReverseTask(task) && <span>可换边</span>}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
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
          {activeTask.unit && <small>{activeTask.unit}</small>}
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
