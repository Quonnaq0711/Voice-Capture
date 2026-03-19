export function TranscriptPanel({ transcript }) {
    return (
        <div className=" mt-4 p-4 rounded-lg bg-grey-100
        min-h[150px] text-base leading-relaxed
        whitespace-pre-wrap overflow-y-auto 
        border border-gray-200">
            {transcript || "Start speaking to see text here..."}
        </div>
    );
}