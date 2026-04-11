import { useState, useRef, useEffect, useCallback } from 'react';
import { voiceApi } from '../services/voiceApi';

const MIN_BLOB_SIZE = 1000;

const MIME_TYPE = (() => {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
})();

/**
 * Hook for press-to-talk voice input.
 *
 * Records while the user holds the button, sends the entire recording
 * as one blob on release. Produces better accuracy than chunked dictation
 * because Whisper gets the full utterance context.
 */
export function usePressTalk({ onTranscript, onError } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const activeRef = useRef(false);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processBlob = useCallback(async (blob) => {
    if (!mountedRef.current || blob.size < MIN_BLOB_SIZE) {
      activeRef.current = false;
      return;
    }

    if (mountedRef.current) setIsProcessing(true);
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const result = await voiceApi.transcribe(blob, controller.signal);
      if (result?.success && result.text && mountedRef.current) {
        onTranscriptRef.current?.(result.text);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        const msg = err.name === 'TimeoutError'
          ? 'Transcription timed out'
          : (err.message || 'Transcription failed');
        onErrorRef.current?.(msg);
      }
    } finally {
      abortRef.current = null;
      activeRef.current = false;
      if (mountedRef.current) setIsProcessing(false);
    }
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !MIME_TYPE) {
      onErrorRef.current?.('Voice recording not supported');
      return;
    }

    activeRef.current = true;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      if (!activeRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: MIME_TYPE });
        chunksRef.current = [];

        // Release mic immediately
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        recorderRef.current = null;

        processBlob(blob);
      };

      recorder.start();
      if (mountedRef.current) setIsRecording(true);
    } catch (err) {
      activeRef.current = false;
      onErrorRef.current?.(err.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : 'Failed to access microphone');
    }
  }, [processBlob]);

  const cancel = useCallback(() => {
    activeRef.current = false;

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (recorderRef.current) {
      try {
        recorderRef.current.onstop = null; // prevent processBlob
        if (recorderRef.current.state === 'recording') recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    if (mountedRef.current) {
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop(); // triggers onstop -> processBlob
      if (mountedRef.current) setIsRecording(false);
    } else {
      // No active recorder — getUserMedia might still be pending.
      // Cancel to prevent orphaned mic capture.
      cancel();
    }
  }, [cancel]);

  return { isRecording, isProcessing, start, stop, cancel };
}
