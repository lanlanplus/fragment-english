import { useMemo, useRef, useState } from 'react';

function isPunctuationOnly(value) {
  return /^[\p{P}\p{S}]+$/u.test(value);
}

export function tokenizeCollectableText(text) {
  const parts = String(text || '').match(/\s+|[^\s]+/gu) || [];
  const tokens = [];
  let whitespace = '';

  parts.forEach((part) => {
    if (/^\s+$/u.test(part)) {
      whitespace += part;
      return;
    }
    if (isPunctuationOnly(part) && tokens.length > 0) {
      tokens[tokens.length - 1].text += `${whitespace}${part}`;
      whitespace = '';
      return;
    }
    tokens.push({ leading: whitespace, text: part });
    whitespace = '';
  });

  return { tokens, trailing: whitespace };
}

export function getSelectedPhrase(tokens, start, end) {
  if (start === null || end === null) return '';
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  return tokens.slice(from, to + 1).map((token, index) => `${index === 0 ? '' : token.leading}${token.text}`).join('');
}

export default function WordRangeCollector({ text, sourceLabel, onCollect, className = '', ariaLabel = '点词收录' }) {
  const { tokens, trailing } = useMemo(() => tokenizeCollectableText(text), [text]);
  const [anchor, setAnchor] = useState(null);
  const [endpoint, setEndpoint] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const feedbackTimerRef = useRef(null);

  const clearSelection = () => {
    setAnchor(null);
    setEndpoint(null);
  };

  const selectToken = (index) => {
    setJustSaved(false);
    if (anchor === null) {
      setAnchor(index);
      setEndpoint(index);
      return;
    }
    setEndpoint(index);
  };

  const selectedText = getSelectedPhrase(tokens, anchor, endpoint);
  const selectionStart = anchor === null ? -1 : Math.min(anchor, endpoint);
  const selectionEnd = anchor === null ? -1 : Math.max(anchor, endpoint);

  const confirmCollection = () => {
    if (!selectedText) return;
    onCollect({ text: selectedText, sourceLabel });
    clearSelection();
    setJustSaved(true);
    window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setJustSaved(false), 1400);
  };

  return (
    <div className={`word-range-collector ${className}`.trim()} aria-label={ariaLabel}>
      <span className="word-range-text">
        {tokens.map((token, index) => {
          const selected = index >= selectionStart && index <= selectionEnd;
          const boundary = selected && (index === selectionStart || index === selectionEnd);
          return (
            <span key={`${index}-${token.text}`}>
              {token.leading}
              <button type="button" className={`word-token${selected ? ' selected' : ''}${boundary ? ' boundary' : ''}`} onClick={() => selectToken(index)} aria-pressed={selected}>
                {token.text}
              </button>
            </span>
          );
        })}
        {trailing}
      </span>
      {(selectedText || justSaved) && (
        <span className="word-range-actions">
          {selectedText && (
            <>
              <button type="button" className="secondary-button compact-button word-range-clear" onClick={clearSelection}>清空重选</button>
              <button type="button" className="primary-button compact-button word-range-confirm" onClick={confirmCollection}>确认收录</button>
            </>
          )}
          {justSaved && <span className="word-range-saved" role="status">已收录</span>}
        </span>
      )}
    </div>
  );
}
