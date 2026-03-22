import { useState, useRef, useCallback, useEffect } from 'react';

// Strip markdown so TTS reads clean prose
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/>\s*/g, '')
    .replace(/[-*+]\s+/g, '')
    .replace(/\d+\.\s+/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Hook for browser-native Text-to-Speech.
 *
 * Designed for streaming: call feedChunk(token) as tokens arrive,
 * sentences are spoken as soon as they're complete.
 * Call flush() when streaming ends to speak any remaining text.
 */
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const bufferRef = useRef('');
  const activeRef = useRef(false);
  const queueRef = useRef([]);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  const speakNext = useCallback(() => {
    if (!activeRef.current || queueRef.current.length === 0) {
      activeRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const text = queueRef.current.shift();
    const cleaned = stripMarkdown(text);
    if (!cleaned) {
      speakNext();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.onend = speakNext;
    utterance.onerror = speakNext;
    window.speechSynthesis.speak(utterance);
  }, []);

  const enqueue = useCallback((text) => {
    if (text.trim()) queueRef.current.push(text);
    if (queueRef.current.length > 0 && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
      speakNext();
    }
  }, [speakNext]);

  const feedChunk = useCallback((token) => {
    if (!activeRef.current) {
      activeRef.current = true;
      setIsSpeaking(true);
    }

    bufferRef.current += token;

    // 1. Split on newlines — AI uses \n for paragraphs, headers, list items
    if (bufferRef.current.includes('\n')) {
      const lines = bufferRef.current.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        enqueue(lines[i]);
      }
      bufferRef.current = lines[lines.length - 1];
      return;
    }

    // 2. Split on sentence-ending punctuation followed by space
    const parts = bufferRef.current.split(/(?<=[.!?。！？:：;；])\s+/);
    if (parts.length > 1) {
      for (let i = 0; i < parts.length - 1; i++) {
        enqueue(parts[i]);
      }
      bufferRef.current = parts[parts.length - 1];
      return;
    }

    // 3. Long buffer without boundary — split at last comma to avoid silence
    if (bufferRef.current.length > 100) {
      const commaIdx = bufferRef.current.lastIndexOf(', ');
      if (commaIdx > 30) {
        enqueue(bufferRef.current.slice(0, commaIdx + 1));
        bufferRef.current = bufferRef.current.slice(commaIdx + 2);
      }
    }
  }, [enqueue]);

  const flush = useCallback(() => {
    if (bufferRef.current.trim()) {
      enqueue(bufferRef.current);
      bufferRef.current = '';
    } else if (queueRef.current.length === 0 && !window.speechSynthesis.speaking) {
      activeRef.current = false;
      setIsSpeaking(false);
    }
  }, [enqueue]);

  const stop = useCallback(() => {
    activeRef.current = false;
    bufferRef.current = '';
    queueRef.current = [];
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, feedChunk, flush, stop };
}
