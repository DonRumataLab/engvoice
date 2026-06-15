# Eng Coach

Eng Coach is an MVP web service for English practice.

## Current MVP

- Two independent screens: Book Reader and Pronunciation Check.
- Paste English text or upload text-based files.
- Supported import formats: TXT, Markdown, HTML, JSON, CSV, SRT, VTT, PDF.
- PDF import reads the embedded text layer. Scanned PDFs need OCR before upload.
- Listen to the text with browser text-to-speech voices.
- In Book Reader, the current spoken phrase is shown in a separate reading panel.
- Adjust voice, speed, and pitch.
- Record speech from the microphone.
- Get first-pass feedback on text match, pace, pronunciation, accuracy, and fluency.
- Review word-by-word scores after a microphone recording.
- Run Word drill 2.0: user segment, slow model, normal model, retry recording, and per-word retry score.

## Run locally

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173
```

Use Chrome or Edge for the best speech recognition support.

## Speech API mode

The browser recognizer is still available as a fallback. For better recognition and word timestamps,
deploy the app with the `/api/transcribe` serverless endpoint and set:

```text
OPENAI_API_KEY=your_api_key
```

The endpoint forwards recordings to OpenAI audio transcriptions with:

- model: `whisper-1`
- response format: `verbose_json`
- timestamp granularity: `word`

GitHub Pages can host the static UI, but it cannot keep an API key secret or run `/api/transcribe`.
Use Vercel or another backend-capable host for Speech API mode.

## Deploy to GitHub Pages

1. Create a GitHub repository, for example `eng-coach`.
2. Push this project to the repository.
3. Open repository `Settings` -> `Pages`.
4. Set `Source` to `Deploy from a branch`.
5. Select branch `main` and folder `/root`.
6. Save and wait for the Pages URL.

The app is prepared to work from a GitHub Pages subpath such as:

```text
https://username.github.io/eng-coach/
```

Keep `.nojekyll` in the repository so GitHub Pages serves files directly.

## Next product steps

1. Add a backend for user accounts, saved practice sessions, and file storage.
2. Replace browser-only speech feedback with AI pronunciation analysis.
3. Support DOCX extraction on the server.
4. Add lesson history, streaks, target sounds, and progress charts.
5. Add native Russian localization after the technical foundation is stable.
