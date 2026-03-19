

export function VoiceToggle({ isRecording, onStart, onStop }) {
    return (
        <button
            onClick={isRecording ? onStop : onStart}
            className={`px-4 py-2 rounded-lg semibold transition-all duration-200 text-white
                ${isRecording ? "bg-red-500 hover:bg-red-700"
                    : "bg-blue-500 hover:bg-blue-700"
                }
                `}
        >
            {isRecording ? "Stop Dictation" : "Start Dictation"}
        </button>
    );
}