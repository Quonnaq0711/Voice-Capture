import { useEffect, useRef, useState } from "react";
import { VoiceCaptureApi } from "../services/cvApi";

export function UseVoice({
    chunktime = 2000,
    onTranscript
}) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const mediaRecordRef = useRef(null);
    const streamRef = useRef(null);
    const isMounted = useRef(false);
    const queueProcess = useRef(Promise.resolve());

    useEffect(() => {
        isMounted.current = true;

        return () => {
            isMounted.current = false;
            stop();
        };
    }, []);

    const start = async () => {
        if (isRecording) return;

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        mediaRecordRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
            if (!event.data || event.data.size === 0) return;

            queueProcess.current = queueProcess.current
                .then(() => processChunk(event.data))
                .catch((error) => {
                    console.error("Chunk process failed", error);
                });
        };
        
        mediaRecorder.start(chunktime);
        setIsProcessing(true);
    };

    const processChunk = async (blob) => {
        if (!isMounted.current) return;

        setIsProcessing(true);
       

        try {
            const res = await VoiceCaptureApi.transcribe(blob);

            if (res?.success && res.text && onTranscript) {
                onTranscript(res.text);
            }

        } catch (error) {
            console.error("Transcription failed", error);
        } finally {
                
            if (isMounted.current) setIsProcessing(false);
        }
    }

    

    const stop = () => {
        if (mediaRecordRef.current) {
            try {
                mediaRecordRef.current.stop();
            } catch { }
            mediaRecordRef.current = null;

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            setIsRecording(false);
        };

        return {
            isProcessing,
            isRecording,
            start,
            stop,
        };
    }
};