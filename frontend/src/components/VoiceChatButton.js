import { useVoiceChat } from "../../hooks/useVoiceChat";
import { Loader2, Square, Mic } from "lucide-react";

export default function VoiceChatButton({ onResponse }) {
 
    const {
        start,
        stop,
        isRecording,
        isThinking
    } = useVoiceChat({ onResponse });

    return (
        <div className="flex items-center gap-3">
            <button
                onMouseDown={start}
                onMouseUp={stop}
                onTouchStart={start}
                onTouchEnd={stop}
                onTouchCancel={stop}
                disabled={isThinking}
                className={`flex items-center justify-center
            size-14 rounded-full transition-all duration-200
            shadow-lg
            ${isRecording ? "bg-red-600 scale-110" :
                        "bg-purple-500 hover:bg-purple-700"
                    }`}
            >
                {isThinking ? (
                    <Loader2 className='animate-spin text-white' />
                ) : isRecording ? (
                    <Square className='text-white' />
                ) : (
                    <Mic className='text-white' />
                )}
            </button>

            <div className="text-sm text-gray-400">
                {isRecording && "Listening..."}
                {isThinking && "Thinking..."}
            </div>

        </div>
    );
}