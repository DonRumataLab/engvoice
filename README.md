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
- Use a free local Web Audio analyzer for voice time, silence, pauses, volume stability, and clipping.
- Optional self-hosted phoneme alignment through Montreal Forced Aligner.
- Review word-by-word scores after a microphone recording.
- Run Word drill 2.0: user segment, slow model, normal model, retry recording, and per-word retry score.

## Run locally

```powershell
npm run dev
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

## Separate aligner backend

Vercel should not run Montreal Forced Aligner directly. Keep Vercel as the public app and deploy the
heavy alignment service separately:

```bash
npm run aligner
```

By default the aligner listens on:

```text
http://0.0.0.0:5174
```

It exposes:

- `GET /health`
- `POST /api/phoneme-align`

Set these variables on the aligner host:

```text
PORT=5174
CORS_ORIGIN=https://engvoice-alpha.vercel.app
ALIGNER_API_TOKEN=change-this-token
MFA_BIN=mfa
FFMPEG_BIN=ffmpeg
MFA_DICTIONARY=english_us_arpa
MFA_ACOUSTIC_MODEL=english_us_arpa
MFA_NUM_JOBS=1
```

Then set these variables in Vercel:

```text
ALIGNER_API_URL=https://your-aligner-host.example.com
ALIGNER_API_TOKEN=change-this-token
```

The browser still calls `/api/phoneme-align` on Vercel. Vercel forwards the recording to the separate
aligner backend, so the public UI does not need to know the private backend token.

## Deploy to UltraVDS or another VPS

Install Node.js 20+ on the server, clone the repository, and create `.env`:

```text
OPENAI_API_KEY=your_api_key
PORT=5173
ALIGNER_API_URL=https://your-aligner-host.example.com
ALIGNER_API_TOKEN=change-this-token
MFA_BIN=mfa
FFMPEG_BIN=ffmpeg
MFA_DICTIONARY=english_us_arpa
MFA_ACOUSTIC_MODEL=english_us_arpa
MFA_NUM_JOBS=1
```

Start the app:

```bash
npm install
npm start
```

For production, run it behind Nginx with HTTPS. Browsers require HTTPS for reliable microphone access
outside `localhost`.

Recommended flow:

1. Point a domain or subdomain to the VPS.
2. Run the Node app on `127.0.0.1:5173` or `0.0.0.0:5173`.
3. Put Nginx in front of it.
4. Add a TLS certificate with Certbot.
5. Keep the app alive with `pm2` or a systemd service.

## Optional free phoneme alignment

The `/api/phoneme-align` endpoint is designed for a self-hosted Montreal Forced Aligner setup.
On Vercel it acts as a proxy to the separate aligner backend. In `server.mjs` it can still run
locally as an all-in-one development server.
Install these on the VPS:

- `ffmpeg`
- Montreal Forced Aligner CLI (`mfa`)
- English acoustic model
- English pronunciation dictionary

The endpoint converts browser `webm` recordings to `wav`, runs `mfa align`, parses the generated
TextGrid, and returns word/phoneme timings to the UI. If MFA is not installed, the app keeps working
and shows that phoneme alignment is not configured.

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
