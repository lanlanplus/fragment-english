import { useEffect, useMemo, useRef, useState } from 'react';
import { APP_STATE_SYNCED_EVENT, FRAGMENTS_LOCAL_UPDATED_EVENT, getFragments, updateFragment } from '../utils/storage.js';
import useEnglishSpeech from '../hooks/useEnglishSpeech.js';

const MIN_SCALE = 0.72;
const MAX_SCALE = 1.8;
const INITIAL_SCALE = 1;
const LABEL_SCALE = 1.22;
const ROTATE_SENSITIVITY_X = 0.3;
const ROTATE_SENSITIVITY_Y = 0.24;
const MAX_TILT = 65;
const DRAG_THRESHOLD = 5;
const AUTO_ROTATE_DEGREES_PER_SECOND = 2.4;
const AUTO_ROTATE_DELAY = 1500;
const DAY = 24 * 60 * 60 * 1000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function reviewTier(lastReviewedAt) {
  if (!lastReviewedAt || Date.now() - new Date(lastReviewedAt).getTime() >= 7 * DAY) return 'bright';
  if (Date.now() - new Date(lastReviewedAt).getTime() < DAY) return 'dim';
  return 'medium';
}

function sphereRadius(count, viewport) {
  const availableRadius = Math.max(118, Math.min(viewport.width, viewport.height) * 0.38);
  const densityRadius = 112 + Math.sqrt(Math.max(count, 1)) * 17;
  return Math.min(availableRadius, Math.max(132, densityRadius));
}

function makeSphere(items) {
  const offset = Math.random() * Math.PI * 2;
  const count = items.length;
  return items.map((item, index) => {
    const yUnit = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
    const theta = GOLDEN_ANGLE * index + offset;
    return {
      ...item,
      unitX: Math.cos(theta) * ringRadius,
      unitY: yUnit,
      unitZ: Math.sin(theta) * ringRadius,
      twinkle: 0.94 + Math.random() * 0.12,
    };
  });
}

function rotatePoint(point, rotation) {
  const radiansX = rotation.x * Math.PI / 180;
  const radiansY = rotation.y * Math.PI / 180;
  const cosX = Math.cos(radiansX);
  const sinX = Math.sin(radiansX);
  const cosY = Math.cos(radiansY);
  const sinY = Math.sin(radiansY);
  const xAfterY = point.x * cosY + point.z * sinY;
  const zAfterY = -point.x * sinY + point.z * cosY;
  return {
    x: xAfterY,
    y: point.y * cosX - zAfterY * sinX,
    z: point.y * sinX + zAfterY * cosX,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function StarMap() {
  const viewportRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const movedRef = useRef(false);
  const rotationRef = useRef({ x: -12 + Math.random() * 24, y: Math.random() * 360 });
  const scaleRef = useRef(INITIAL_SCALE);
  const isInteractingRef = useRef(false);
  const resumeAtRef = useRef(0);
  const selectedIdRef = useRef('');
  const [fragments, setFragments] = useState(() => getFragments());
  const [viewport, setViewport] = useState({ width: 360, height: 560 });
  const [sphereSeed] = useState(() => Math.random());
  const [rotation, setRotation] = useState(rotationRef.current);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [selectedId, setSelectedId] = useState('');
  const [cardAnchor, setCardAnchor] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const { speak, speakingId } = useEnglishSpeech();

  const radius = sphereRadius(fragments.length, viewport);
  const sphereLayout = useMemo(() => makeSphere(fragments), [fragments.length, sphereSeed]);
  const currentById = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const stars = sphereLayout.map((star) => ({
    ...star,
    ...currentById.get(star.id),
    x: star.unitX * radius,
    y: star.unitY * radius,
    z: star.unitZ * radius,
  }));
  const selected = stars.find((star) => star.id === selectedId);
  const overdueCount = fragments.filter((fragment) => reviewTier(fragment.lastReviewedAt) === 'bright').length;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const measure = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const refresh = () => setFragments(getFragments());
    window.addEventListener(APP_STATE_SYNCED_EVENT, refresh);
    window.addEventListener(FRAGMENTS_LOCAL_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(APP_STATE_SYNCED_EVENT, refresh);
      window.removeEventListener(FRAGMENTS_LOCAL_UPDATED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    let frameId;
    let previousTime;
    const animate = (time) => {
      if (previousTime === undefined) previousTime = time;
      const elapsed = Math.min(40, time - previousTime);
      previousTime = time;
      if (!isInteractingRef.current && !selectedIdRef.current && time >= resumeAtRef.current) {
        const next = { ...rotationRef.current, y: rotationRef.current.y + AUTO_ROTATE_DEGREES_PER_SECOND * elapsed / 1000 };
        rotationRef.current = next;
        setRotation(next);
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const pauseAutoRotation = (delay = AUTO_ROTATE_DELAY) => {
    resumeAtRef.current = performance.now() + delay;
  };

  const closeCard = () => {
    setSelectedId('');
    setCardAnchor(null);
    setFlipped(false);
    pauseAutoRotation();
  };

  const commitScale = (requestedScale) => {
    const next = clamp(requestedScale, MIN_SCALE, MAX_SCALE);
    scaleRef.current = next;
    setScale(next);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (selectedIdRef.current) closeCard();
    pauseAutoRotation();
    commitScale(scaleRef.current * Math.exp(-event.deltaY * 0.0013));
  };

  const handlePointerDown = (event) => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    movedRef.current = false;
    isInteractingRef.current = true;
    resumeAtRef.current = Infinity;
    if (selectedIdRef.current) closeCard();
    const points = [...pointersRef.current.values()];
    if (points.length === 1) {
      gestureRef.current = { type: 'rotate', start: points[0], origin: rotationRef.current };
    } else if (points.length === 2) {
      const [a, b] = points;
      gestureRef.current = {
        type: 'pinch',
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: scaleRef.current,
      };
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length === 2) {
      const [a, b] = points;
      const gesture = gestureRef.current;
      if (gesture?.type !== 'pinch') return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (!movedRef.current && Math.abs(distance - gesture.distance) > DRAG_THRESHOLD) {
        movedRef.current = true;
        pointersRef.current.forEach((_point, pointerId) => viewportRef.current.setPointerCapture(pointerId));
      }
      commitScale(gesture.scale * distance / Math.max(gesture.distance, 1));
      return;
    }
    if (points.length !== 1 || gestureRef.current?.type !== 'rotate') return;
    const dx = points[0].x - gestureRef.current.start.x;
    const dy = points[0].y - gestureRef.current.start.y;
    if (!movedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      movedRef.current = true;
      viewportRef.current.setPointerCapture(event.pointerId);
    }
    const next = {
      x: clamp(gestureRef.current.origin.x - dy * ROTATE_SENSITIVITY_Y, -MAX_TILT, MAX_TILT),
      y: gestureRef.current.origin.y + dx * ROTATE_SENSITIVITY_X,
    };
    rotationRef.current = next;
    setRotation(next);
  };

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const point = [...pointersRef.current.values()][0];
      gestureRef.current = { type: 'rotate', start: point, origin: rotationRef.current };
      return;
    }
    gestureRef.current = null;
    isInteractingRef.current = false;
    pauseAutoRotation();
  };

  const selectStar = (event, id) => {
    event.stopPropagation();
    if (movedRef.current) return;
    const starRect = event.currentTarget.getBoundingClientRect();
    const viewportRect = viewportRef.current.getBoundingClientRect();
    const width = Math.min(310, viewport.width - 24);
    const height = 264;
    const starX = starRect.left + starRect.width / 2 - viewportRect.left;
    const starY = starRect.top + starRect.height / 2 - viewportRect.top;
    setCardAnchor({
      left: clamp(starX + 18, 12, viewport.width - width - 12),
      top: clamp(starY - height / 2, 12, viewport.height - height - 12),
      width,
    });
    setSelectedId(id);
    setFlipped(false);
    resumeAtRef.current = Infinity;
  };

  const flipCard = () => {
    if (!selected || flipped) return;
    const now = new Date().toISOString();
    const next = updateFragment(selected.id, {
      reviewCount: (selected.reviewCount || 0) + 1,
      lastReviewedAt: now,
      updatedAt: now,
    });
    setFragments(next);
    setFlipped(true);
  };

  if (!fragments.length) {
    return <div className="star-map-page star-map-empty">先去碎片页收录一些词，让夜空亮起来吧 ✦</div>;
  }

  return (
    <div className="star-map-page">
      <p className="star-map-hint">
        {overdueCount ? `有 ${overdueCount} 颗久违的星星在等你` : '这片星空刚刚被你照看过'}
      </p>
      <div
        ref={viewportRef}
        className="star-map-viewport sphere-viewport"
        data-scale={scale.toFixed(2)}
        data-rotation-x={rotation.x.toFixed(2)}
        data-rotation-y={rotation.y.toFixed(2)}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => {
          if (!movedRef.current && selectedIdRef.current) closeCard();
        }}
      >
        <div className={`sphere-stage ${scale >= LABEL_SCALE ? 'labels-visible' : ''}`} style={{ transform: `scale(${scale})` }}>
          <span className="sphere-aura" style={{ width: radius * 2.12, height: radius * 2.12 }} />
          <div className="sphere-orbit" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
            {stars.map((star) => {
              const rotated = rotatePoint(star, rotation);
              const depth = clamp((rotated.z / radius + 1) / 2, 0, 1);
              const depthScale = 0.56 + depth * 0.64;
              const depthOpacity = 0.06 + depth * 0.94;
              return (
                <button
                  key={star.id}
                  type="button"
                  className={`star-node star-${reviewTier(star.lastReviewedAt)} ${selectedId === star.id ? 'selected' : ''}`}
                  style={{
                    '--twinkle': star.twinkle,
                    '--depth-opacity': depthOpacity,
                    '--depth-scale': depthScale,
                    '--depth': depth,
                    zIndex: Math.round(depth * 1000),
                    transform: `translate3d(${star.x}px, ${star.y}px, ${star.z}px) rotateY(${-rotation.y}deg) rotateX(${-rotation.x}deg) translate(-50%, -50%) scale(${depthScale})`,
                  }}
                  onClick={(event) => selectStar(event, star.id)}
                  aria-label={`查看 ${star.source || star.text}`}
                  data-depth={depth.toFixed(3)}
                >
                  <span className="star-dot" />
                  <span className="star-label">{star.source || star.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selected && cardAnchor && (
          <div
            className={`star-card ${flipped ? 'flipped' : ''}`}
            style={cardAnchor}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="star-card-flipper" onClick={flipCard} aria-label={flipped ? '词条解析' : '翻转查看解析'}>
              <span className="star-card-inner">
                <span className="star-card-face star-card-front">
                  <span>{selected.source || selected.text}</span>
                  <small>轻触卡片查看解析</small>
                </span>
                <span className="star-card-face star-card-back">
                  <strong>{selected.translation}</strong>
                  {selected.scene && <span><em>场景</em>{selected.scene}</span>}
                  {selected.better && <span><em>更地道</em>{selected.better}</span>}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="star-speak-button"
              onClick={() => speak(selected.source || selected.text, selected.id)}
              aria-label="朗读英文原文"
            >
              {speakingId === selected.id ? '⏸' : '🔊'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
