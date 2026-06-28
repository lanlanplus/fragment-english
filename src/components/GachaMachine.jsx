import { useEffect, useMemo, useRef, useState } from 'react';
import { getDailyGacha, getFragments, saveDailyGacha } from '../utils/storage.js';

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function GachaMachine() {
  const [cards, setCards] = useState([]);
  const [flippedIds, setFlippedIds] = useState([]);
  const [speakingId, setSpeakingId] = useState('');
  const speakingIdRef = useRef('');
  const library = useMemo(() => getFragments(), []);
  const canPlay = library.length >= 5;
  const completed = canPlay && cards.length === 5 && flippedIds.length === 5;

  useEffect(() => {
    if (!canPlay) return;

    const cached = getDailyGacha();
    if (cached?.length === 5) {
      setCards(cached);
      return;
    }

    const todaysCards = shuffle(library).slice(0, 5);
    saveDailyGacha(todaysCards);
    setCards(todaysCards);
  }, [canPlay, library]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
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

  const renderSpeakButton = (text, id) => (
    <button
      type="button"
      className="icon-button speak-button gacha-speak-button"
      onClick={(event) => {
        event.stopPropagation();
        speakEnglish(text, id);
      }}
      aria-label="朗读英文原文"
    >
      {speakingId === id ? '⏸' : '🔊'}
    </button>
  );

  const toggleFlip = (id) => {
    setFlippedIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  if (!canPlay) {
    return (
      <div className="module centered-module">
        <div className="gacha-orb">🫙</div>
        <div className="empty-state">再多收集几个碎片，扭蛋机就能转起来了 🫙</div>
      </div>
    );
  }

  return (
    <div className="module">
      <section className="gacha-hero">
        <div>
          <p className="card-kicker">today’s five</p>
          <h2>今日单词扭蛋</h2>
        </div>
        <span className="gacha-count">{flippedIds.length}/5</span>
      </section>

      <div className="gacha-grid">
        {cards.map((card) => {
          const isFlipped = flippedIds.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={`flip-card ${isFlipped ? 'flipped' : ''}`}
              onClick={() => toggleFlip(card.id)}
            >
              <span className="flip-inner">
                <span className="flip-face front">
                  <span>{card.source}</span>
                </span>
                <span className="flip-face back">
                  <span className="gacha-source">{card.source}</span>
                  {renderSpeakButton(card.source, card.id)}
                  <strong>{card.translation}</strong>
                  <small>{card.scene}</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {completed && (
        <div className="complete-banner">
          <span className="sparkle">✦</span>
          今日扭蛋完成 🎉
          <span className="sparkle delay">✦</span>
        </div>
      )}
    </div>
  );
}
