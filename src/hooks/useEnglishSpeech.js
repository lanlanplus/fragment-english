import { useEffect, useRef, useState } from 'react';

export default function useEnglishSpeech() {
  const [speakingId, setSpeakingId] = useState('');
  const speakingIdRef = useRef('');

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = (text, id) => {
    if (!window.speechSynthesis || !text) return;
    if (speakingIdRef.current === id) {
      window.speechSynthesis.cancel();
      speakingIdRef.current = '';
      setSpeakingId('');
      return;
    }

    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.voice = voices.find((voice) => voice.name.includes('Google US English') || voice.name.includes('Samantha'))
      || voices.find((voice) => voice.lang === 'en-US')
      || null;
    const finish = () => {
      if (speakingIdRef.current !== id) return;
      speakingIdRef.current = '';
      setSpeakingId('');
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    speakingIdRef.current = id;
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  return { speak, speakingId };
}
