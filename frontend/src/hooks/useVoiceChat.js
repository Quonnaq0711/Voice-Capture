import { VoiceCaptureApi } from "../services/cvApi";
import { useState, useRef } from "react";

export function useVoiceChat({ onResponse }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isThinking, setIsThinking] = useState(false);

    const media = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);

    const start = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        streamRef.current = stream;

        const recorder = new MediaRecorder(stream, { Mimetype: "audio/webm" });

        media.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0)
                chunksRef.current.push(event.data)
        }

        recorder.onStop = () => {
            const blip = new Blob(chunksRef.current, { type: "audio/webm" })
        

            setIsThinking(true);

            try {
                const res = VoiceCaptureApi.voice_chat(blip);
            
                if (res?.success) {

                    const audio = new Audio(
                        `data:audio/wav;base64,${res.audio}`
                    );

                    audio.play()

                    onResponse?.({
                        user: res.user_text,
                        assistant: res.response
                    });
                }
            
            } finally {

                setIsThinking(false);
            
            }

        };

        recorder.start();
        setIsRecording(true);
    };

    const stop = () => {
        media.current?.stop();
        streamRef.current?.getTracks().forEach(t => t.stop());
        setIsRecording(false)
    };

    return {
        start,
        stop,
        isThinking,
        isRecording
    };
}