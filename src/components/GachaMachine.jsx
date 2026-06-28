import { useEffect, useMemo, useState } from 'react';
import { getDailyGacha, getFragments, saveDailyGacha } from '../utils/storage.js';

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function GachaMachine() {
  const [cards, setCards] = useState([]);
  const [flippedIds, setFlippedIds] = useState([]);
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
