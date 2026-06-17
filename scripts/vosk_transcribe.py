import json
import sys
import wave

from vosk import KaldiRecognizer, Model


def main():
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: vosk_transcribe.py MODEL_DIR WAV_PATH"}))
        return 2

    model_dir = sys.argv[1]
    wav_path = sys.argv[2]
    model = Model(model_dir)

    with wave.open(wav_path, "rb") as wav:
        if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            print(json.dumps({"error": "WAV must be mono 16-bit PCM."}))
            return 2

        recognizer = KaldiRecognizer(model, wav.getframerate())
        recognizer.SetWords(True)
        words = []
        texts = []

        while True:
            data = wav.readframes(4000)
            if not data:
                break

            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                if result.get("text"):
                    texts.append(result["text"])
                words.extend(result.get("result", []))

        final = json.loads(recognizer.FinalResult())
        if final.get("text"):
            texts.append(final["text"])
        words.extend(final.get("result", []))

    normalized_words = [
        {
            "word": item.get("word", ""),
            "start": item.get("start"),
            "end": item.get("end"),
            "confidence": item.get("conf"),
        }
        for item in words
        if item.get("word") and item.get("start") is not None and item.get("end") is not None
    ]

    print(
        json.dumps(
            {
                "engine": "vosk",
                "text": " ".join(texts).strip(),
                "words": normalized_words,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
