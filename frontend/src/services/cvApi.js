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

        if (!res.ok) {
            let errorData;
            try {
                errorData = await res.json();
            } catch {
                errorData = null;
            } 

            const message = errorData?.detail || errorData?.message ||
                `Request failed with status ${res.status}`;
            
            const err = new Error(message);
            err.status = res.status;
            err.body = errorData;
            throw err;
        }

        return res;

    } catch (error) {
        
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - Server may have slowed or file too large');
        }

        throw error;
    } finally {
        clearTimeout(sig);
    }
}


export const VoiceCaptureApi = {
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
            console.error('[Voice Capture API] failed batch transcribe', error);
            throw error;
        }
    },

    async synthsize(text, voice = null) {
        try {
            const res = await fetchDelay(`${VC_BASE_API}/speech`, {
                method: 'POST',
                headers: { 'Content-type': 'application/json' },
                body: JSON.stringify({text, voice}),
            }, 30000)

            return await handleResponse(res);
        } catch (error) {
            console.error('[Voice Capture API] Synthesize Failed', error);
            throw error;
        }
    },

    async chat(message, content = []) {
        try {
            const res = await fetchDelay(`${VC_BASE_API}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, content })
            }, 60000);

            return await handleResponse(res);
        } catch (error) {
            console.error('[Voice Capture API] chat failed', error)
            throw error
        }
    },

    async voice_chat(audioblob) {
        try {
            const formdata = new FormData();
            formdata.append('file', audioblob, 'audio.webm');

            const res = await fetchDelay(`${VC_BASE_API}/voice-chat`, {
                method: 'POST',
                body: formdata
            }, 60000)

            return await handleResponse(res);
        } catch (error) {
            console.error('[Voice Capture API] Voice Chat Failed', error)
            throw error
        }
    },

    async checkStatus() {
        try {
            const res = await fetchDelay(`${VC_BASE_API}/`, {
                method: 'GET',
                headers: {'Content-Type': 'application/json'}
            })

            return await handleResponse(res);
        } catch (error) {
            console.error('[Voice Capture Api] Status Check Failed', error)
            throw error;
        }
    },
}; 