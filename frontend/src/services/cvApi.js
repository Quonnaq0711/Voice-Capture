const VC_BASE_API = "/api/v1/vc";

async function handleResponse(res) {
    const content = res.headers.get('content-type');
    if (content && content.includes('application/json')) {
        return await res.json();
    }
    return res
}

async function fetchDelay(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const sig = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(sig);

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail)
        }
        return res;
    } catch (error) {
        clearTimeout(sig);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - Server may have slowed or file too large');
        }
        throw error;
    }
}


const VoiceCaptureApi = {
    async transcribe(audioblob) {
        try {
            const formData = new FormData();
            formData.append('file', audioblob, 'audio.webm')

            const res = await fetchDelay(`${VC_BASE_API}/transcribe`, {
                method: 'POST',
                body: formData
            }, 30000);

            return await handleResponse(res);
            
        } catch (error) {
            console.error('[Voice Capture API] Failed to Transcribe', error);
            throw error;
        }
    },

    async batchTranscribe(audioblobs) {
        try {
            const formData = new FormData();
            audioblobs.forEach((blob, index) => {
                formData.append('files', blob, `audio-${index}.webm`)
            });

            const res = await fetchDelay(`${VC_BASE_API}/batch`, {
                method: 'POST',
                body: formData
            }, 120000) // two minute processing for batches
            
            return await handleResponse(res);

        } catch (error) {
            console.error('[Voice Capture Api] failed batch transcribe', error);
            throw error;
        }
    },

    async synthsize() {}
}; 