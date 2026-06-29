import { useEffect, useMemo, useRef, useState } from 'react';
import { APP_STATE_SYNCED_EVENT, getDailyGacha, getFragments, saveDailyGacha } from '../utils/storage.js';

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function GachaMachine() {
  const [cards, setCards] = useState([]);
  const [flippedIds, setFlippedIds] = useState([]);
  const [speakingId, setSpeakingId] = useState('');
  const [syncVersion, setSyncVersion] = useState(0);
  const speakingIdRef = useRef('');
  const library = useMemo(() => getFragments(), [syncVersion]);
  const canPlay = library.length >= 5;
  const completed = canPlay && cards.length === 5 && flippedIds.length === 5;

  useEffect(() => {
    if (!canPlay) return;

    const cached = getDailyGacha();
    if (cached?.cards?.length === 5) {
      setCards(cached.cards);
      setFlippedIds(cached.flippedIds || []);
      return;
    }

    const todaysCards = shuffle(library).slice(0, 5);
    saveDailyGacha(todaysCards, []);
    setCards(todaysCards);
    setFlippedIds([]);
  }, [canPlay, library]);

  useEffect(() => {
    const refreshGacha = () => {
      setSyncVersion((version) => version + 1);
    };

    window.addEventListener(APP_STATE_SYNCED_EVENT, refreshGacha);
    return () => {
      window.removeEventListener(APP_STATE_SYNCED_EVENT, refreshGacha);
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
    setFlippedIds((current) => {
      const nextFlippedIds = current.includes(id) ? current : [...current, id];
      saveDailyGacha(cards, nextFlippedIds);
      return nextFlippedIds;
    });
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
