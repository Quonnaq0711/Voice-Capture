import { useState, useRef, useEffect, useCallback } from 'react';
import { voiceApi } from '../services/voiceApi';

// Skip blobs smaller than this — too short for meaningful speech
const MIN_BLOB_SIZE = 1000;

// Pick a mimeType the browser actually supports (Safari lacks audio/webm)
const MIME_TYPE = (() => {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
})();

/**
 * Hook for voice dictation using backend Whisper STT.
 *
 * Uses stop-restart cycling (not timeslice) so every chunk sent to Whisper
 * is a complete, standalone audio file with valid headers.
 */
export function useVoiceDictation({
  chunkInterval = 3000,
  onTranscript,
  onError,
} = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const recordingRef = useRef(false); // ref guard against rapid toggles
  const processingQueue = useRef(Promise.resolve());
  const pendingRef = useRef(0);
  const abortRef = useRef(null);

  // Use refs for callbacks to avoid stale closures in recorder/interval handlers
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup(true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePending = useCallback((delta) => {
    pendingRef.current += delta;
    if (mountedRef.current) {
      setIsProcessing(pendingRef.current > 0);
    }
  }, []);

  const processChunk = useCallback(async (blob) => {
    if (!mountedRef.current || blob.size < MIN_BLOB_SIZE) return;

    updatePending(1);
    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const result = await voiceApi.transcribe(blob, controller.signal);
      if (result?.success && result.text && mountedRef.current) {
        onTranscriptRef.current?.(result.text);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (mountedRef.current) {
        const msg = err.name === 'TimeoutError'
          ? 'Transcription timed out'
          : (err.message || 'Transcription failed');
        onErrorRef.current?.(msg);
      }
    } finally {
      abortRef.current = null;
      updatePending(-1);
    }
  }, [updatePending]);

  const createRecorder = useCallback((stream) => {
    const opts = MIME_TYPE ? { mimeType: MIME_TYPE } : undefined;
    const recorder = new MediaRecorder(stream, opts);
    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      processingQueue.current = processingQueue.current
        .then(() => processChunk(e.data))
        .catch(() => {});
    };
    return recorder;
  }, [processChunk]);

  const cycleRecorder = useCallback(() => {
    if (!streamRef.current || !mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state !== 'recording') return;

    mediaRecorderRef.current.stop(); // triggers ondataavailable with complete blob
    const newRecorder = createRecorder(streamRef.current);
    mediaRecorderRef.current = newRecorder;
    newRecorder.start();
  }, [createRecorder]);

  // abort=true: cancel in-flight (used on unmount). abort=false: let queued chunks finish.
  const cleanup = useCallback((abort) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (abort && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop(); // flush final chunk
        }
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    recordingRef.current = false;
  }, []);

  const startRecording = useCallback(async () => {
    // Ref guard: prevents double-start on rapid clicks (state may not have updated yet)
    if (recordingRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onErrorRef.current?.('Voice recording is not supported in this browser');
      return;
    }
    if (!MIME_TYPE) {
      onErrorRef.current?.('No supported audio format found');
      return;
    }

    recordingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // If stop() was called while awaiting getUserMedia, discard the stream
      if (!recordingRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      const recorder = createRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.start(); // no timeslice — produces complete file on stop()

      intervalRef.current = setInterval(cycleRecorder, chunkInterval);

      setIsRecording(true);
    } catch (err) {
      recordingRef.current = false;
      onErrorRef.current?.(err.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : 'Failed to access microphone');
    }
  }, [chunkInterval, createRecorder, cycleRecorder]);

  const stopRecording = useCallback(() => {
    // abort=false: let in-flight and final chunk finish transcribing
    cleanup(false);
    setIsRecording(false);
    // Don't force setIsProcessing(false) — let pending chunks resolve naturally
  }, [cleanup]);

  const toggleRecording = useCallback(() => {
    if (recordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
