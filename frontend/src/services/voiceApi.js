const VOICE_API_BASE = '/api/voice';
const TRANSCRIBE_TIMEOUT = 15000; // 15s — fail fast if backend is stuck

function createTimeoutSignal(ms, externalSignal) {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);

  // If external signal fires first, forward it
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), { once: true });
    }
  }

  // Clean up timer when request completes (caller doesn't need to worry about it)
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });

  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

export const voiceApi = {
  async transcribe(audioBlob, externalSignal) {
    const ext = audioBlob.type?.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('file', audioBlob, `recording.${ext}`);

    const { signal, cleanup } = createTimeoutSignal(TRANSCRIBE_TIMEOUT, externalSignal);

    try {
      const res = await fetch(`${VOICE_API_BASE}/transcribe`, {
        method: 'POST',
        body: formData,
        signal,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.detail || `Transcription failed (${res.status})`);
      }

      return res.json();
    } finally {
      cleanup();
    }
  },

  async checkHealth() {
    const res = await fetch(`${VOICE_API_BASE}/health`);
    return res.json();
  },
};
