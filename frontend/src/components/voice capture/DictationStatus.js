export function DictationStatus({ isRecording, isProcessing }) {
    let label = "Idle";
    let dotColor = "bg-gray-400";
    let textColor = "text-gray-600";

    if (isRecording && !isProcessing) {
        label = "Listening...";
        dotColor = "bg-green-500";
        textColor = "text-green-700";
    }

    if (isProcessing) {
        label = "Processing...";
        dotColor = "bg-amber-500"
        textColor = "text-amber-700"
    }

    return (
        <div className="flex items-center gap-2">
            <span className={`size-3 rounded-full ${dotColor}
            ${isRecording && !isProcessing ? "animate-pulseSlow" : ""}`}
            />
            <span className={`text-sm ${textColor}`}>{label}</span>
        </div>
    );
}
