import { useState } from "react";
import { UseVoice } from "../../hooks/useVoiceCapture";
import { VoiceToggle } from "./voiceToggle";
import { DictationStatus } from "./DictationStatus";
import { TranscriptPanel } from "./TranscriptPanel";

export function VoiceToolBar() {
    const [transcript, setTranscript] = useState("");
    const { isRecording, isProcessing, start, stop } = UseVoice({
        chunktime: 2000,
        onTranscript: (text) => {
            setTranscript(prev => prev + " " + text);
        }
    });

    return (
        <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-4">
                <VoiceToggle
                    isRecording={isRecording}
                    onStart={start}
                    onStop={stop}
                />

                <DictationStatus
                    isRecording={isRecording}
                    isProcessing={isProcessing}
                />
            </div>
            <TranscriptPanel
                transcript={transcript}
            />

        </div>
    );
}