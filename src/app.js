const tabButtons = document.querySelectorAll(".tab-btn");
const screens = document.querySelectorAll(".screen");
const appScriptUrl = new URL(document.currentScript?.src || "./src/app.js", document.baseURI);
const readerText = document.querySelector("#readerText");
const readerFileInput = document.querySelector("#readerFileInput");
const readerFileName = document.querySelector("#readerFileName");
const readerWordCount = document.querySelector("#readerWordCount");
const readerReadTime = document.querySelector("#readerReadTime");
const readerTargetPace = document.querySelector("#readerTargetPace");
const readerVoiceSelect = document.querySelector("#readerVoiceSelect");
const readerSpeakBtn = document.querySelector("#readerSpeakBtn");
const readerPauseBtn = document.querySelector("#readerPauseBtn");
const readerStopBtn = document.querySelector("#readerStopBtn");
const readerRateInput = document.querySelector("#readerRateInput");
const readerPitchInput = document.querySelector("#readerPitchInput");
const readerCurrentText = document.querySelector("#readerCurrentText");
const sourceText = document.querySelector("#sourceText");
const fileInput = document.querySelector("#fileInput");
const fileName = document.querySelector("#fileName");
const wordCount = document.querySelector("#wordCount");
const readTime = document.querySelector("#readTime");
const targetPace = document.querySelector("#targetPace");
const voiceSelect = document.querySelector("#voiceSelect");
const speakBtn = document.querySelector("#speakBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const stopBtn = document.querySelector("#stopBtn");
const rateInput = document.querySelector("#rateInput");
const pitchInput = document.querySelector("#pitchInput");
const recordBtn = document.querySelector("#recordBtn");
const playRecordingBtn = document.querySelector("#playRecordingBtn");
const recordingTimer = document.querySelector("#recordingTimer");
const recordingPlayer = document.querySelector("#recordingPlayer");
const practiceScore = document.querySelector("#practiceScore");
const scoreSummary = document.querySelector("#scoreSummary");
const feedbackList = document.querySelector("#feedbackList");
const transcriptText = document.querySelector("#transcriptText");
const paceMetric = document.querySelector("#paceMetric");
const pronunciationMetric = document.querySelector("#pronunciationMetric");
const accuracyMetric = document.querySelector("#accuracyMetric");
const fluencyMetric = document.querySelector("#fluencyMetric");
const wordAnalysisSummary = document.querySelector("#wordAnalysisSummary");
const wordAnalysisList = document.querySelector("#wordAnalysisList");
const audioAnalysisSummary = document.querySelector("#audioAnalysisSummary");
const voiceTimeMetric = document.querySelector("#voiceTimeMetric");
const silenceMetric = document.querySelector("#silenceMetric");
const pauseMetric = document.querySelector("#pauseMetric");
const volumeMetric = document.querySelector("#volumeMetric");
const stabilityMetric = document.querySelector("#stabilityMetric");
const clippingMetric = document.querySelector("#clippingMetric");
const audioAnalysisTips = document.querySelector("#audioAnalysisTips");
const phonemeAnalysisSummary = document.querySelector("#phonemeAnalysisSummary");
const phonemeAnalysisList = document.querySelector("#phonemeAnalysisList");
const startDrillBtn = document.querySelector("#startDrillBtn");
const drillStatus = document.querySelector("#drillStatus");
const drillWordList = document.querySelector("#drillWordList");
const rebuiltPhrasePlayer = document.querySelector("#rebuiltPhrasePlayer");
const rebuiltPhraseStatus = document.querySelector("#rebuiltPhraseStatus");
const supportStatus = document.querySelector("#supportStatus");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

let voices = [];
let mediaRecorder = null;
let audioChunks = [];
let recordingStartedAt = 0;
let timerId = null;
let recognition = null;
let transcript = "";
let transcriptConfidence = 0;
let latestRecordingDurationMs = 0;
let latestSpeechWindow = null;
let latestTranscriptionWords = [];
let latestAudioAnalysis = null;
let latestPhonemeAlignment = null;
let latestRecordingAudioBuffer = null;
let recordingAudioContext = null;
let activeSegmentSource = null;
let rebuiltPhraseUrl = null;
let wordAnalysis = [];
let speechQueue = [];
let speechQueueIndex = 0;
let speechStopped = false;
let speechDisplay = null;
let speechFallbackTimer = null;

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ") : [];
}

function renderTextStats(textarea, countElement, readTimeElement, paceElement) {
  const words = tokenize(textarea.value).length;
  const minutes = words / 150;
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.max(0, Math.round((minutes - wholeMinutes) * 60));
  countElement.textContent = words.toString();
  readTimeElement.textContent = `${wholeMinutes}:${seconds.toString().padStart(2, "0")}`;
  paceElement.textContent = words > 80 ? "145" : "120";
}

function updateTextStats() {
  renderTextStats(sourceText, wordCount, readTime, targetPace);
}

function updateReaderTextStats() {
  renderTextStats(readerText, readerWordCount, readerReadTime, readerTargetPace);
}

async function extractTextFromPdf(file) {
  const pdfjsLib = await import(new URL("../vendor/pdfjs/pdf.min.js", appScriptUrl).toString());
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "../vendor/pdfjs/pdf.worker.min.js",
    appScriptUrl,
  ).toString();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) pages.push(text);
  }

  return pages.join("\n\n");
}

function extractTextFromFile(name, rawText) {
  const extension = name.split(".").pop()?.toLowerCase();

  if (extension === "html" || extension === "htm") {
    const documentText = new DOMParser().parseFromString(rawText, "text/html");
    return documentText.body.textContent || rawText;
  }

  if (extension === "json") {
    try {
      const json = JSON.parse(rawText);
      return JSON.stringify(json, null, 2).replace(/[{}\[\]",:]/g, " ");
    } catch {
      return rawText;
    }
  }

  if (extension === "srt" || extension === "vtt") {
    return rawText
      .split(/\r?\n/)
      .filter((line) => !/^\d+$/.test(line.trim()))
      .filter((line) => !line.includes("-->"))
      .join(" ");
  }

  if (extension === "csv") {
    return rawText.replace(/[,\t;]/g, " ");
  }

  return rawText;
}

function populateVoiceSelect(selectElement) {
  selectElement.innerHTML = "";

  if (!voices.length) {
    const option = new Option("English voice from browser", "");
    selectElement.add(option);
    return;
  }

  voices.forEach((voice) => {
    const option = new Option(`${voice.name} (${voice.lang})`, voice.name);
    selectElement.add(option);
  });
}

function loadVoices() {
  voices = window.speechSynthesis
    ? window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("en"))
    : [];

  populateVoiceSelect(voiceSelect);
  populateVoiceSelect(readerVoiceSelect);
}

function cleanSpeechText(value) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTextForSpeech(value, maxLength = 180) {
  const text = cleanSpeechText(value);
  if (!text) return [];

  const sentences = text.match(/[^.!?;:]+[.!?;:]?|[^.!?;:]+$/g) || [text];
  const chunks = [];
  let current = "";

  sentences.forEach((sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) return;

    if (trimmed.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      const words = trimmed.split(" ");
      let wordChunk = "";

      words.forEach((word) => {
        const next = wordChunk ? `${wordChunk} ${word}` : word;
        if (next.length > maxLength && wordChunk) {
          chunks.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = next;
        }
      });

      if (wordChunk) chunks.push(wordChunk);
      return;
    }

    const next = current ? `${current} ${trimmed}` : trimmed;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = trimmed;
    } else {
      current = next;
    }
  });

  if (current) chunks.push(current);
  return chunks;
}

function setSpeechDisplayMessage(message) {
  if (!speechDisplay) return;
  speechDisplay.textContent = message;
}

function renderSpeechChunk(chunk, activeCharIndex = -1) {
  if (!speechDisplay) return;

  speechDisplay.textContent = "";

  const wordPattern = /\S+/g;
  let lastIndex = 0;
  let match = wordPattern.exec(chunk);

  while (match) {
    const word = match[0];
    const start = match.index;
    const end = start + word.length;

    if (start > lastIndex) {
      speechDisplay.append(document.createTextNode(chunk.slice(lastIndex, start)));
    }

    const wordElement = document.createElement("span");
    wordElement.textContent = word;

    if (activeCharIndex >= start && activeCharIndex < end) {
      wordElement.className = "current-word";
    }

    speechDisplay.append(wordElement);
    lastIndex = end;
    match = wordPattern.exec(chunk);
  }

  if (lastIndex < chunk.length) {
    speechDisplay.append(document.createTextNode(chunk.slice(lastIndex)));
  }
}

function getWordRanges(chunk) {
  const ranges = [];
  const wordPattern = /\S+/g;
  let match = wordPattern.exec(chunk);

  while (match) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    match = wordPattern.exec(chunk);
  }

  return ranges;
}

function clearSpeechFallbackTimer() {
  if (!speechFallbackTimer) return;
  window.clearInterval(speechFallbackTimer);
  speechFallbackTimer = null;
}

function startSpeechFallbackHighlight(chunk, rate) {
  clearSpeechFallbackTimer();
  if (!speechDisplay) return;

  const ranges = getWordRanges(chunk);
  if (ranges.length <= 1) return;

  let index = 0;
  const wordsPerMinute = 145 * Math.max(rate, 0.65);
  const intervalMs = Math.max(180, Math.round(60000 / wordsPerMinute));

  speechFallbackTimer = window.setInterval(() => {
    if (speechStopped || window.speechSynthesis?.paused) return;

    index = Math.min(index + 1, ranges.length - 1);
    renderSpeechChunk(chunk, ranges[index].start);

    if (index >= ranges.length - 1) {
      clearSpeechFallbackTimer();
    }
  }, intervalMs);
}

function speakNextChunk() {
  if (speechStopped || speechQueueIndex >= speechQueue.length || !window.speechSynthesis) {
    if (speechDisplay && speechQueueIndex >= speechQueue.length) {
      setSpeechDisplayMessage("Playback finished.");
    }
    clearSpeechFallbackTimer();
    return;
  }

  const chunk = speechQueue[speechQueueIndex];
  const utterance = new SpeechSynthesisUtterance(chunk);
  const controls = utteranceControls;
  const selectedVoice = voices.find((voice) => voice.name === controls.voiceSelect.value);
  utterance.lang = selectedVoice?.lang || "en-US";
  utterance.voice = selectedVoice || null;
  utterance.rate = Number(controls.rateInput.value);
  utterance.pitch = Number(controls.pitchInput.value);
  renderSpeechChunk(chunk, 0);
  startSpeechFallbackHighlight(chunk, utterance.rate);
  utterance.onboundary = (event) => {
    if (event.name === "word" || event.charIndex >= 0) {
      clearSpeechFallbackTimer();
      renderSpeechChunk(chunk, event.charIndex);
    }
  };
  utterance.onend = () => {
    clearSpeechFallbackTimer();
    speechQueueIndex += 1;
    speakNextChunk();
  };
  window.speechSynthesis.speak(utterance);
}

let utteranceControls = {
  voiceSelect,
  rateInput,
  pitchInput,
};

function speakTextFrom(text, controls, displayElement = null) {
  speechQueue = splitTextForSpeech(text);
  if (!speechQueue.length || !window.speechSynthesis) return;

  speechStopped = true;
  window.speechSynthesis.cancel();
  speechStopped = false;
  speechQueueIndex = 0;
  utteranceControls = controls;
  speechDisplay = displayElement;
  setSpeechDisplayMessage("Starting playback...");

  speakNextChunk();
}

function speakText() {
  speakTextFrom(sourceText.value, { voiceSelect, rateInput, pitchInput });
}

function speakReaderText() {
  speakTextFrom(
    readerText.value,
    {
      voiceSelect: readerVoiceSelect,
      rateInput: readerRateInput,
      pitchInput: readerPitchInput,
    },
    readerCurrentText,
  );
}

function pauseSpeech() {
  if (!window.speechSynthesis) return;
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    pauseBtn.textContent = "Pause";
    readerPauseBtn.textContent = "Pause";
  } else {
    window.speechSynthesis.pause();
    pauseBtn.textContent = "Resume";
    readerPauseBtn.textContent = "Resume";
  }
}

function stopSpeech() {
  if (!window.speechSynthesis) return;
  speechStopped = true;
  speechQueue = [];
  speechQueueIndex = 0;
  clearSpeechFallbackTimer();
  window.speechSynthesis.cancel();
  pauseBtn.textContent = "Pause";
  readerPauseBtn.textContent = "Pause";
  setSpeechDisplayMessage("Playback stopped.");
}

function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function startTimer() {
  recordingStartedAt = Date.now();
  recordingTimer.textContent = "00:00";
  timerId = window.setInterval(() => {
    recordingTimer.textContent = formatTimer(Date.now() - recordingStartedAt);
  }, 250);
}

function stopTimer() {
  window.clearInterval(timerId);
  timerId = null;
}

function startRecognition() {
  transcript = "";
  transcriptConfidence = 0;
  transcriptText.textContent = "Listening...";

  if (!SpeechRecognition) {
    transcriptText.textContent =
      "This browser has no built-in speech recognition. The recording will work, but text analysis will be limited.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onresult = (event) => {
    const results = Array.from(event.results);
    transcript = results.map((result) => result[0].transcript).join(" ");
    const confidences = results
      .map((result) => result[0].confidence)
      .filter((confidence) => Number.isFinite(confidence) && confidence > 0);
    transcriptConfidence = confidences.length
      ? confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
      : transcriptConfidence;
    transcriptText.textContent = transcript || "Listening...";
  };

  recognition.onerror = () => {
    transcriptText.textContent =
      "Speech recognition is unavailable. Check microphone permission and browser support.";
  };

  recognition.start();
}

function stopRecognition() {
  if (!recognition) return;
  recognition.stop();
  recognition = null;
}

function compareWords(expectedText, spokenText) {
  const expected = tokenize(expectedText);
  const spoken = tokenize(spokenText);
  const spokenSet = new Set(spoken);
  const matched = expected.filter((word) => spokenSet.has(word)).length;
  const coverage = expected.length ? matched / expected.length : 0;
  const missing = expected.filter((word) => !spokenSet.has(word)).slice(0, 8);
  return { coverage, missing, expectedCount: expected.length, spokenCount: spoken.length };
}

function scoreTranscriptCandidate(expectedText, spokenText) {
  const expected = tokenize(expectedText);
  const spoken = tokenize(spokenText);
  if (!expected.length || !spoken.length) return 0;

  const aligned = alignWords(expected, spoken);
  const similaritySum = aligned.reduce(
    (sum, item) => sum + wordSimilarity(item.expected, item.spoken),
    0,
  );
  const orderScore = similaritySum / Math.max(expected.length, 1);
  const lengthPenalty = Math.min(1, spoken.length / Math.max(expected.length, 1));
  const extraPenalty = Math.max(0, spoken.length - expected.length) / Math.max(expected.length, 1);

  return Math.max(0, orderScore * 0.82 + lengthPenalty * 0.18 - extraPenalty * 0.16);
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function wordSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  return longest ? Math.max(0, 1 - levenshteinDistance(a, b) / longest) : 0;
}

function alignWords(expected, spoken) {
  const rows = expected.length + 1;
  const cols = spoken.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  const back = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (let row = 1; row < rows; row += 1) {
    dp[row][0] = row;
    back[row][0] = "delete";
  }

  for (let col = 1; col < cols; col += 1) {
    dp[0][col] = col;
    back[0][col] = "insert";
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const similarity = wordSimilarity(expected[row - 1], spoken[col - 1]);
      const substitutionCost = similarity > 0.55 ? 1 - similarity : 1.05;
      const candidates = [
        { cost: dp[row - 1][col - 1] + substitutionCost, move: "match" },
        { cost: dp[row - 1][col] + 1, move: "delete" },
        { cost: dp[row][col - 1] + 1, move: "insert" },
      ];
      const best = candidates.sort((a, b) => a.cost - b.cost)[0];
      dp[row][col] = best.cost;
      back[row][col] = best.move;
    }
  }

  const aligned = [];
  let row = expected.length;
  let col = spoken.length;

  while (row > 0 || col > 0) {
    const move = back[row][col];

    if (move === "match") {
      aligned.unshift({
        expected: expected[row - 1],
        spoken: spoken[col - 1],
        spokenIndex: col - 1,
      });
      row -= 1;
      col -= 1;
    } else if (move === "delete") {
      aligned.unshift({
        expected: expected[row - 1],
        spoken: "",
        spokenIndex: -1,
      });
      row -= 1;
    } else {
      col -= 1;
    }
  }

  return aligned;
}

function scorePace(pace) {
  if (!Number.isFinite(pace) || pace <= 0) return 0;
  if (pace >= 95 && pace <= 165) return 100;
  return Math.max(25, 100 - Math.abs(130 - pace));
}

function getTimedTranscriptText() {
  return latestTranscriptionWords.map((item) => item.word).join(" ");
}

function getApiWordTiming(wordIndex, durationSeconds) {
  const apiWord = latestTranscriptionWords[wordIndex];
  if (!apiWord) return null;

  const previous = latestTranscriptionWords[wordIndex - 1];
  const next = latestTranscriptionWords[wordIndex + 1];
  const rawStart = Math.max(0, apiWord.start);
  const rawEnd = Math.max(rawStart + 0.08, apiWord.end);
  const startLimit = previous ? (previous.end + rawStart) / 2 : Math.max(0, rawStart - 0.1);
  const endLimit = next ? (rawEnd + next.start) / 2 : Math.min(durationSeconds, rawEnd + 0.14);
  const center = (rawStart + rawEnd) / 2;
  const minDuration = Math.min(0.42, Math.max(0.18, rawEnd - rawStart));
  const start = Math.max(0, Math.min(startLimit, center - minDuration / 2));
  const end = Math.min(durationSeconds, Math.max(endLimit, center + minDuration / 2));

  return {
    start,
    end: Math.max(start + 0.18, end),
  };
}

function getAlignmentWordTiming(alignmentWord, wordIndex, alignmentWords) {
  if (!alignmentWord) return null;

  const previous = alignmentWords[wordIndex - 1];
  const next = alignmentWords[wordIndex + 1];
  const rawStart = Math.max(0, Number(alignmentWord.start));
  const rawEnd = Math.max(rawStart + 0.08, Number(alignmentWord.end));
  const startLimit = previous ? (Number(previous.end) + rawStart) / 2 : Math.max(0, rawStart - 0.08);
  const endLimit = next ? (rawEnd + Number(next.start)) / 2 : rawEnd + 0.12;
  const start = Math.max(0, Math.min(startLimit, rawStart));
  const end = Math.max(start + 0.16, Math.max(rawEnd, endLimit));

  return { start, end };
}

function applyPhonemeAlignmentToWordAnalysis(alignment) {
  const alignmentWords = Array.isArray(alignment?.words)
    ? alignment.words
        .map((word) => ({
          ...word,
          normalized: normalizeText(word.label || ""),
        }))
        .filter((word) => word.normalized && Number.isFinite(word.start) && Number.isFinite(word.end))
    : [];

  const expectedWords = tokenize(sourceText.value);
  if (!alignmentWords.length || !expectedWords.length) return 0;

  const previousRowsByWord = new Map(wordAnalysis.map((row) => [normalizeText(row.expected), row]));
  const nextRows = [];
  let updated = 0;

  expectedWords.forEach((expected, index) => {
    const alignmentWord = alignmentWords[index];
    const timing = getAlignmentWordTiming(alignmentWord, index, alignmentWords);
    const previousRow = previousRowsByWord.get(expected) || wordAnalysis[index];
    const spoken = alignmentWord?.normalized || previousRow?.spoken || "aligned";
    const similarity = wordSimilarity(expected, spoken);
    const accuracy = Math.round(similarity * 100);

    if (timing) updated += 1;

    nextRows.push({
      id: index,
      expected,
      spoken,
      spokenIndex: index,
      startTime: timing?.start ?? previousRow?.startTime ?? null,
      endTime: timing?.end ?? previousRow?.endTime ?? null,
      pace: previousRow?.pace ?? 100,
      pronunciation: previousRow?.pronunciation ?? accuracy,
      accuracy: previousRow?.accuracy ?? accuracy,
      fluency: previousRow?.fluency ?? 100,
      timingSource: timing ? "MFA direct timing" : "MFA missing timing",
      needsDrill: previousRow?.needsDrill ?? false,
      replacementAudioBuffer: previousRow?.replacementAudioBuffer ?? null,
      phonemes: alignmentWord?.phonemes || [],
    });
  });

  if (alignmentWords.length > expectedWords.length) {
    alignmentWords.slice(expectedWords.length).forEach((alignmentWord, extraIndex) => {
      const index = expectedWords.length + extraIndex;
      const timing = getAlignmentWordTiming(alignmentWord, index, alignmentWords);
      if (timing) updated += 1;

      nextRows.push({
        id: index,
        expected: alignmentWord.normalized,
        spoken: alignmentWord.normalized,
        spokenIndex: index,
        startTime: timing?.start ?? null,
        endTime: timing?.end ?? null,
        pace: 100,
        pronunciation: 100,
        accuracy: 100,
        fluency: 100,
        timingSource: timing ? "MFA direct timing" : "MFA missing timing",
        needsDrill: false,
        replacementAudioBuffer: null,
        phonemes: alignmentWord.phonemes || [],
      });
    });
  }

  wordAnalysis = nextRows;
  renderWordAnalysis({ rows: wordAnalysis });
  updateRebuiltPhrasePlayer();
  return updated;
}

function formatRowTiming(row) {
  if (!Number.isFinite(row.startTime) || !Number.isFinite(row.endTime)) {
    return row.timingSource;
  }

  return `${row.timingSource}: ${row.startTime.toFixed(2)}-${row.endTime.toFixed(2)}s`;
}

function buildWordAnalysis(expectedText, spokenText, durationMs) {
  const expected = tokenize(expectedText);
  const timedText = getTimedTranscriptText();
  const spoken = latestTranscriptionWords.length ? tokenize(timedText) : tokenize(spokenText);
  const aligned = alignWords(expected, spoken);
  const durationMinutes = Math.max(durationMs / 60000, 1 / 60);
  const pace = Math.round(spoken.length / durationMinutes);
  const paceScore = scorePace(pace);
  const recognitionConfidence = transcriptConfidence || 0.68;
  const spokenCount = Math.max(spoken.length, 1);
  const durationSeconds = durationMs / 1000;
  const speechStart = latestSpeechWindow?.start ?? 0;
  const speechEnd = latestSpeechWindow?.end ?? durationSeconds;
  const speechDuration = Math.max(0.4, speechEnd - speechStart);
  const wordSlotSeconds = speechDuration / spokenCount;

  const rows = aligned.map((item, index) => {
    const similarity = wordSimilarity(item.expected, item.spoken);
    const exact = item.expected === item.spoken;
    const pronunciation = item.spoken
      ? Math.round(similarity * 82 + recognitionConfidence * 18)
      : 0;
    const accuracy = exact ? 100 : Math.round(similarity * 100);
    const fluency = item.spoken ? Math.round((paceScore + accuracy) / 2) : 0;
    const apiTiming = item.spokenIndex >= 0 ? getApiWordTiming(item.spokenIndex, durationSeconds) : null;
    const fallbackStart =
      item.spokenIndex >= 0
        ? speechStart + Math.max(0, item.spokenIndex * wordSlotSeconds - wordSlotSeconds * 0.18)
        : null;
    const fallbackEnd =
      item.spokenIndex >= 0
        ? speechStart +
          Math.min(speechDuration, (item.spokenIndex + 1) * wordSlotSeconds + wordSlotSeconds * 0.24)
        : null;
    const startTime = apiTiming?.start ?? fallbackStart;
    const endTime = apiTiming?.end ?? fallbackEnd;

    return {
      id: index,
      expected: item.expected,
      spoken: item.spoken || "missed",
      spokenIndex: item.spokenIndex,
      startTime,
      endTime,
      pace: paceScore,
      pronunciation: Math.max(0, Math.min(100, pronunciation)),
      accuracy: Math.max(0, Math.min(100, accuracy)),
      fluency: Math.max(0, Math.min(100, fluency)),
      timingSource: apiTiming ? "Speech API timing" : item.spokenIndex >= 0 ? "estimated timing" : "no timing",
      needsDrill: !item.spoken || pronunciation < 82 || accuracy < 80,
    };
  });

  const average = (key) =>
    rows.length
      ? Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length)
      : 0;

  return {
    rows,
    summary: {
      pace,
      paceScore,
      pronunciation: average("pronunciation"),
      accuracy: average("accuracy"),
      fluency: average("fluency"),
    },
  };
}

function metricClass(score) {
  if (score >= 85) return "is-good";
  if (score >= 65) return "is-mid";
  return "is-low";
}

const phoneticHints = {
  a: "/eI/",
  against: "/e'genst/",
  and: "/aend/",
  book: "/buk/",
  brown: "/braun/",
  check: "/tSek/",
  clear: "/klIr/",
  dog: "/dog/",
  english: "/'INglIS/",
  every: "/'evri/",
  feedback: "/'fi:dbaek/",
  first: "/f3:rst/",
  fox: "/faks/",
  improve: "/Im'pru:v/",
  jumps: "/dZVmps/",
  lazy: "/'leIzi/",
  natural: "/'naetSrel/",
  over: "/'ouver/",
  practice: "/'praektIs/",
  pronunciation: "/pre,nVnsi'eISen/",
  quickly: "/'kwIkli/",
  repeat: "/rI'pi:t/",
  slowly: "/'slouli/",
  sound: "/saund/",
  speech: "/spi:tS/",
  text: "/tekst/",
  the: "/de/",
  then: "/den/",
  to: "/tu:/",
  try: "/traI/",
  voice: "/voIs/",
  word: "/w3:rd/",
};

function getPhoneticHint(word) {
  const normalized = normalizeText(word);
  if (phoneticHints[normalized]) return phoneticHints[normalized];

  return `/${normalized
    .replace(/th/g, "th")
    .replace(/sh/g, "sh")
    .replace(/ch/g, "ch")
    .replace(/ph/g, "f")
    .replace(/tion$/g, "shen")
    .replace(/ough/g, "oh")}/`;
}

function scoreRetryWord(expected, spoken) {
  const spokenWord = tokenize(spoken)[0] || "";
  const similarity = wordSimilarity(normalizeText(expected), spokenWord);
  return {
    spoken: spokenWord || "not recognized",
    pronunciation: Math.round(similarity * 88 + 12),
    accuracy: Math.round(similarity * 100),
  };
}

function renderWordAnalysis(analysis) {
  wordAnalysis = analysis.rows;
  wordAnalysisList.textContent = "";
  drillWordList.textContent = "";

  const drillRows = wordAnalysis.filter((row) => row.needsDrill);
  const visibleDrillRows = [...wordAnalysis].sort((a, b) => {
    if (a.needsDrill === b.needsDrill) return a.id - b.id;
    return a.needsDrill ? -1 : 1;
  });
  wordAnalysisSummary.textContent = wordAnalysis.length
    ? `${wordAnalysis.length} words checked, ${drillRows.length} need attention.`
    : "Record speech to see word scores.";
  startDrillBtn.disabled = wordAnalysis.length === 0;
  drillStatus.textContent = wordAnalysis.length
    ? `${wordAnalysis.length} drill cards ready. Words that need attention are shown first, but every word can be replayed, compared, and recorded again.`
    : "Record speech to build a correction drill.";

  wordAnalysis.forEach((row) => {
    const card = document.createElement("article");
    card.className = `word-card ${row.needsDrill ? "needs-drill" : ""}`;

    const wordBlock = document.createElement("div");
    const expected = document.createElement("strong");
    expected.textContent = row.expected;
    const heard = document.createElement("small");
    heard.textContent = `heard: ${row.spoken}`;
    wordBlock.append(expected, heard);
    card.append(wordBlock);

    [
      ["pron", row.pronunciation],
      ["acc", row.accuracy],
      ["pace", row.pace],
      ["flow", row.fluency],
    ].forEach(([label, score]) => {
      const metric = document.createElement("span");
      metric.className = metricClass(score);
      metric.textContent = score;
      const metricLabel = document.createElement("small");
      metricLabel.textContent = label;
      metric.append(metricLabel);
      card.append(metric);
    });

    wordAnalysisList.append(card);
  });

  visibleDrillRows.forEach((row) => {
    drillWordList.append(createDrillCard(row));
  });
  updateRebuiltPhrasePlayer();
}

function createDrillCard(row) {
  const card = document.createElement("article");
  card.className = `drill-card ${row.needsDrill ? "needs-drill" : "is-clear"}`;
  card.dataset.wordId = row.id;

  const main = document.createElement("div");
  main.className = "drill-card-main";

  const word = document.createElement("strong");
  word.textContent = row.expected;

  const phonetic = document.createElement("span");
  phonetic.className = "phonetic-hint";
  phonetic.textContent = getPhoneticHint(row.expected);

  const heard = document.createElement("small");
  heard.textContent = `heard: ${row.spoken}`;

  const timing = document.createElement("small");
  timing.textContent = formatRowTiming(row);

  const status = document.createElement("span");
  status.className = `drill-status-badge ${row.needsDrill ? "needs-drill" : "is-clear"}`;
  status.textContent = row.needsDrill ? "needs practice" : "checked";

  main.append(word, status, phonetic, heard, timing);

  const score = document.createElement("span");
  score.className = `drill-score ${metricClass(row.pronunciation)}`;
  score.textContent = `${row.pronunciation}`;

  const actions = document.createElement("div");
  actions.className = "drill-actions";

  [
    ["Your + model", () => runDrillForWord(row)],
    ["New + model", () => runNewDrillForWord(row)],
    ["Normal model", () => speakModelWord(row.expected, 0.95)],
    ["Record again", () => recordWordRetry(row, card)],
  ].forEach(([label, handler]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    actions.append(button);
  });

  const retry = document.createElement("p");
  retry.className = "retry-result";
  retry.textContent = "Repeat this word until the retry score improves.";

  card.append(main, score, actions, retry);
  return card;
}

function waitForRecordingMetadata() {
  if (Number.isFinite(recordingPlayer.duration) && recordingPlayer.duration > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    recordingPlayer.addEventListener("loadedmetadata", resolve, { once: true });
  });
}

function stopActiveRecordingSegment() {
  if (!activeSegmentSource) return;

  try {
    activeSegmentSource.stop();
  } catch {
    // The segment may have already ended.
  }
  activeSegmentSource = null;
}

async function prepareRecordingAudioBuffer(blob) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return;

  try {
    if (recordingAudioContext) {
      stopActiveRecordingSegment();
      await recordingAudioContext.close();
    }

    recordingAudioContext = new AudioContextConstructor();
    latestRecordingAudioBuffer = await recordingAudioContext.decodeAudioData(await blob.arrayBuffer());
  } catch {
    latestRecordingAudioBuffer = null;
  }
}

function playBufferedRecordingSegment(startTime, endTime) {
  if (!latestRecordingAudioBuffer || !recordingAudioContext) return null;

  const duration = latestRecordingAudioBuffer.duration;
  const start = Math.max(0, Math.min(startTime, duration));
  const end = Math.max(start + 0.18, Math.min(endTime, duration));
  const segmentDuration = Math.max(0.18, Math.min(duration - start, end - start));
  if (!Number.isFinite(segmentDuration) || segmentDuration <= 0) return null;

  stopActiveRecordingSegment();
  const source = recordingAudioContext.createBufferSource();
  source.buffer = latestRecordingAudioBuffer;
  source.connect(recordingAudioContext.destination);
  activeSegmentSource = source;

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (activeSegmentSource === source) activeSegmentSource = null;
      resolve(true);
    };

    source.onended = finish;
    recordingAudioContext.resume().then(() => {
      source.start(0, start, segmentDuration);
      window.setTimeout(finish, Math.ceil(segmentDuration * 1000) + 120);
    });
  });
}

function createBufferFromSegment(audioBuffer, startTime, endTime) {
  const sampleRate = audioBuffer.sampleRate;
  const startFrame = Math.max(0, Math.floor(startTime * sampleRate));
  const endFrame = Math.min(audioBuffer.length, Math.ceil(endTime * sampleRate));
  const frameCount = Math.max(1, endFrame - startFrame);
  const segment = new AudioBuffer({
    length: frameCount,
    numberOfChannels: audioBuffer.numberOfChannels,
    sampleRate,
  });

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    segment.copyToChannel(
      audioBuffer.getChannelData(channel).slice(startFrame, endFrame),
      channel,
    );
  }

  return segment;
}

function encodeAudioBufferToWav(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const sampleCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = sampleCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channelCount, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let frame = 0; frame < sampleCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function concatenateAudioBuffers(buffers) {
  const usableBuffers = buffers.filter(Boolean);
  if (!usableBuffers.length || !recordingAudioContext) return null;

  const sampleRate = recordingAudioContext.sampleRate;
  const channelCount = Math.max(...usableBuffers.map((buffer) => buffer.numberOfChannels));
  const totalLength = usableBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const output = new AudioBuffer({
    length: totalLength,
    numberOfChannels: channelCount,
    sampleRate,
  });
  let writeOffset = 0;

  usableBuffers.forEach((buffer) => {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sourceChannel = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
      output.copyToChannel(sourceChannel, channel, writeOffset);
    }
    writeOffset += buffer.length;
  });

  return output;
}

function updateRebuiltPhrasePlayer() {
  if (!rebuiltPhrasePlayer || !latestRecordingAudioBuffer) return;

  const buffers = wordAnalysis.map((row) => {
    if (row.replacementAudioBuffer) return row.replacementAudioBuffer;
    if (!Number.isFinite(row.startTime) || !Number.isFinite(row.endTime)) return null;
    return createBufferFromSegment(latestRecordingAudioBuffer, row.startTime, row.endTime);
  });
  const phraseBuffer = concatenateAudioBuffers(buffers);

  if (!phraseBuffer) {
    rebuiltPhrasePlayer.hidden = true;
    rebuiltPhraseStatus.textContent = "Updated phrase is not available for this recording.";
    return;
  }

  if (rebuiltPhraseUrl) URL.revokeObjectURL(rebuiltPhraseUrl);
  rebuiltPhraseUrl = URL.createObjectURL(encodeAudioBufferToWav(phraseBuffer));
  rebuiltPhrasePlayer.src = rebuiltPhraseUrl;
  rebuiltPhrasePlayer.hidden = false;
  const replacements = wordAnalysis.filter((row) => row.replacementAudioBuffer).length;
  rebuiltPhraseStatus.textContent = replacements
    ? `${replacements} word${replacements === 1 ? "" : "s"} replaced in the updated phrase.`
    : "Updated phrase currently matches the original recording.";
}

async function playRecordingSegment(startTime, endTime) {
  if (!recordingPlayer.src || startTime === null || endTime === null) return false;

  const bufferedPlayback = playBufferedRecordingSegment(startTime, endTime);
  if (bufferedPlayback) return bufferedPlayback;

  await waitForRecordingMetadata();
  const duration = Number.isFinite(recordingPlayer.duration)
    ? recordingPlayer.duration
    : latestRecordingDurationMs / 1000;
  const start = Math.max(0, Math.min(startTime, duration));
  const end = Math.min(duration, Math.max(start + 0.25, Math.min(endTime, duration)));

  recordingPlayer.pause();
  recordingPlayer.currentTime = start;
  try {
    await recordingPlayer.play();
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    window.setTimeout(() => {
      recordingPlayer.pause();
      resolve(true);
    }, Math.max(250, (end - start) * 1000));
  });
}

async function detectSpeechWindow(blob) {
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const audioContext = new AudioContextConstructor();
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(buffer);
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const frameSize = Math.max(1, Math.floor(sampleRate * 0.04));
    const frames = [];

    for (let offset = 0; offset < channel.length; offset += frameSize) {
      let sum = 0;
      const end = Math.min(offset + frameSize, channel.length);

      for (let index = offset; index < end; index += 1) {
        sum += channel[index] * channel[index];
      }

      frames.push(Math.sqrt(sum / Math.max(1, end - offset)));
    }

    const maxRms = Math.max(...frames);
    const threshold = Math.max(0.012, maxRms * 0.16);
    const first = frames.findIndex((value) => value >= threshold);
    const last = frames.findLastIndex((value) => value >= threshold);

    await audioContext.close();

    if (first < 0 || last < first) return null;

    return {
      start: Math.max(0, (first * frameSize) / sampleRate - 0.08),
      end: Math.min(audioBuffer.duration, ((last + 1) * frameSize) / sampleRate + 0.16),
    };
  } catch {
    return null;
  }
}

async function analyzeAudioSignal(blob) {
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const audioContext = new AudioContextConstructor();
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(buffer);
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const frameSeconds = 0.04;
    const frameSize = Math.max(1, Math.floor(sampleRate * frameSeconds));
    const frames = [];
    let clippedSamples = 0;

    for (let offset = 0; offset < channel.length; offset += frameSize) {
      let sum = 0;
      let peak = 0;
      const end = Math.min(offset + frameSize, channel.length);

      for (let index = offset; index < end; index += 1) {
        const sample = channel[index];
        const absolute = Math.abs(sample);
        sum += sample * sample;
        peak = Math.max(peak, absolute);
        if (absolute > 0.98) clippedSamples += 1;
      }

      frames.push({
        rms: Math.sqrt(sum / Math.max(1, end - offset)),
        peak,
        start: offset / sampleRate,
        end: end / sampleRate,
      });
    }

    const maxRms = Math.max(...frames.map((frame) => frame.rms), 0);
    const threshold = Math.max(0.012, maxRms * 0.16);
    const activeFrames = frames.filter((frame) => frame.rms >= threshold);
    const firstActive = frames.findIndex((frame) => frame.rms >= threshold);
    const lastActive = frames.findLastIndex((frame) => frame.rms >= threshold);
    const duration = audioBuffer.duration;
    const voiceTime = activeFrames.length * frameSeconds;
    const silenceRatio = duration ? Math.max(0, 1 - voiceTime / duration) : 1;
    const activeRmsValues = activeFrames.map((frame) => frame.rms);
    const averageRms = activeRmsValues.length
      ? activeRmsValues.reduce((sum, value) => sum + value, 0) / activeRmsValues.length
      : 0;
    const rmsVariance = activeRmsValues.length
      ? activeRmsValues.reduce((sum, value) => sum + (value - averageRms) ** 2, 0) /
        activeRmsValues.length
      : 0;
    const rmsStdDev = Math.sqrt(rmsVariance);
    const stability = averageRms ? Math.max(0, 100 - (rmsStdDev / averageRms) * 130) : 0;
    const clippingRatio = channel.length ? clippedSamples / channel.length : 0;

    let pauseCount = 0;
    let currentPause = 0;
    frames.forEach((frame) => {
      if (frame.rms < threshold) {
        currentPause += frameSeconds;
      } else {
        if (currentPause >= 0.35) pauseCount += 1;
        currentPause = 0;
      }
    });
    if (currentPause >= 0.35) pauseCount += 1;

    const speechWindow =
      firstActive >= 0 && lastActive >= firstActive
        ? {
            start: Math.max(0, frames[firstActive].start - 0.08),
            end: Math.min(duration, frames[lastActive].end + 0.16),
          }
        : null;

    await audioContext.close();

    return {
      averageRms,
      clippingRatio,
      duration,
      pauseCount,
      signalScore: Math.round(
        Math.max(0, Math.min(100, stability * 0.45 + (1 - silenceRatio) * 35 + (1 - clippingRatio) * 20)),
      ),
      silenceRatio,
      speechWindow,
      stability: Math.round(stability),
      voiceTime,
    };
  } catch {
    return null;
  }
}

function renderAudioAnalysis(analysis) {
  latestAudioAnalysis = analysis;

  if (!analysis) {
    audioAnalysisSummary.textContent = "Audio analysis is unavailable in this browser.";
    return;
  }

  const silencePercent = Math.round(analysis.silenceRatio * 100);
  const clippingPercent = Math.round(analysis.clippingRatio * 1000) / 10;
  const volumePercent = Math.round(Math.min(100, analysis.averageRms * 420));
  const tips = [];

  voiceTimeMetric.textContent = `${analysis.voiceTime.toFixed(1)}s`;
  silenceMetric.textContent = `${silencePercent}%`;
  pauseMetric.textContent = analysis.pauseCount.toString();
  volumeMetric.textContent = `${volumePercent}%`;
  stabilityMetric.textContent = `${analysis.stability}%`;
  clippingMetric.textContent = `${clippingPercent}%`;
  audioAnalysisSummary.textContent = `Local signal score: ${analysis.signalScore}/100`;

  if (volumePercent < 18) {
    tips.push("Move closer to the microphone or speak a little louder.");
  }

  if (clippingPercent > 1) {
    tips.push("The microphone is clipping. Reduce input gain or move slightly farther away.");
  }

  if (silencePercent > 45) {
    tips.push("There is a lot of silence. Start speaking sooner and keep the phrase connected.");
  }

  if (analysis.pauseCount > 3) {
    tips.push("Too many long pauses. Practice the phrase in smaller chunks, then connect them.");
  }

  if (analysis.stability < 55) {
    tips.push("Volume is uneven. Keep a steadier distance from the microphone.");
  }

  if (!tips.length) {
    tips.push("Signal quality looks usable. Focus on pronunciation and rhythm.");
  }

  audioAnalysisTips.textContent = "";
  tips.forEach((tip) => {
    const item = document.createElement("li");
    item.textContent = tip;
    audioAnalysisTips.append(item);
  });
}

async function transcribeWithSpeechApi(blob) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "en");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const prompt = cleanSpeechText(sourceText.value).slice(0, 800);
  if (prompt) {
    formData.append("prompt", prompt);
  }

  const response = await fetch("./api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Speech API unavailable (${response.status})`);
  }

  const data = await response.json();
  return {
    text: data.text || "",
    words: Array.isArray(data.words)
      ? data.words
          .map((word) => ({
            word: normalizeText(word.word),
            start: Number(word.start),
            end: Number(word.end),
          }))
          .filter((word) => word.word && Number.isFinite(word.start) && Number.isFinite(word.end))
      : [],
  };
}

async function transcribeWithLocalAsr(blob) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  const response = await fetch("./api/local-transcribe", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.error || `Local ASR unavailable (${response.status})`);
  }

  const data = await response.json();
  return {
    text: data.text || "",
    words: Array.isArray(data.words)
      ? data.words
          .map((word) => ({
            word: normalizeText(word.word),
            start: Number(word.start),
            end: Number(word.end),
            confidence: Number(word.confidence),
          }))
          .filter((word) => word.word && Number.isFinite(word.start) && Number.isFinite(word.end))
      : [],
  };
}

async function alignPhonemesWithMfa(blob) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");
  formData.append("referenceText", cleanSpeechText(sourceText.value));

  const response = await fetch("./api/phoneme-align", {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.error || `MFA unavailable (${response.status})`);
  }

  return data;
}

function renderPhonemeAlignment(alignment) {
  latestPhonemeAlignment = alignment;
  phonemeAnalysisList.textContent = "";

  if (!alignment?.words?.length) {
    phonemeAnalysisSummary.textContent = "Phoneme alignment is not available yet.";
    return;
  }

  const updatedDrillWords = applyPhonemeAlignmentToWordAnalysis(alignment);
  phonemeAnalysisSummary.textContent = updatedDrillWords
    ? `${alignment.words.length} words aligned by MFA. ${updatedDrillWords} drill timings updated.`
    : `${alignment.words.length} words aligned by MFA. Drill timings were not updated.`;

  alignment.words.forEach((word) => {
    const card = document.createElement("article");
    card.className = "phoneme-card";

    const header = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = word.label;
    const time = document.createElement("small");
    time.textContent = `${word.start.toFixed(2)}-${word.end.toFixed(2)}s`;
    header.append(label, time);

    const phones = document.createElement("div");
    phones.className = "phoneme-chip-list";
    word.phonemes.forEach((phone) => {
      const chip = document.createElement("span");
      chip.textContent = `${phone.label} ${(phone.end - phone.start).toFixed(2)}s`;
      phones.append(chip);
    });

    if (!word.phonemes.length) {
      const chip = document.createElement("span");
      chip.textContent = "no phoneme alignment";
      phones.append(chip);
    }

    card.append(header, phones);
    phonemeAnalysisList.append(card);
  });
}

async function runPhonemeAlignment(blob) {
  phonemeAnalysisSummary.textContent = "Running self-hosted MFA phoneme alignment...";
  phonemeAnalysisList.textContent = "";

  try {
    renderPhonemeAlignment(await alignPhonemesWithMfa(blob));
  } catch (error) {
    latestPhonemeAlignment = null;
    phonemeAnalysisSummary.textContent = "MFA phoneme alignment is not configured on this host.";
    const item = document.createElement("article");
    item.className = "phoneme-card";
    item.textContent =
      error instanceof Error
        ? error.message
        : "Install Montreal Forced Aligner on the server to enable phoneme analysis.";
    phonemeAnalysisList.append(item);
  }
}

function speakModelWord(word, rate = 0.82) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(word);
    const selectedVoice = voices.find((voice) => voice.name === voiceSelect.value);
    utterance.lang = selectedVoice?.lang || "en-US";
    utterance.voice = selectedVoice || null;
    utterance.rate = rate;
    utterance.pitch = Number(pitchInput.value);
    utterance.onend = resolve;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

function recognizeSingleWord(timeoutMs = 2600) {
  return new Promise((resolve) => {
    if (!SpeechRecognition) {
      resolve({ text: "", confidence: 0 });
      return;
    }

    const retryRecognition = new SpeechRecognition();
    let bestText = "";
    let bestConfidence = 0;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        retryRecognition.stop();
      } catch {
        // Recognition may already be stopped by the browser.
      }
      resolve({ text: bestText, confidence: bestConfidence });
    };

    retryRecognition.lang = "en-US";
    retryRecognition.interimResults = false;
    retryRecognition.continuous = false;
    retryRecognition.onresult = (event) => {
      const result = event.results?.[0]?.[0];
      bestText = result?.transcript || "";
      bestConfidence = result?.confidence || 0;
      finish();
    };
    retryRecognition.onerror = finish;
    retryRecognition.onend = finish;
    retryRecognition.start();
    window.setTimeout(finish, timeoutMs);
  });
}

function recordRetryAudio(timeoutMs = 2600) {
  return new Promise(async (resolve) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      resolve({ blob: null, text: "", confidence: 0 });
      return;
    }

    let stream = null;
    let retryRecognition = null;
    let settled = false;
    let bestText = "";
    let bestConfidence = 0;
    const chunks = [];

    const finish = () => {
      if (settled) return;
      settled = true;

      try {
        retryRecognition?.stop();
      } catch {
        // Recognition may already be stopped by the browser.
      }

      resolve({
        blob: chunks.length ? new Blob(chunks, { type: "audio/webm" }) : null,
        text: bestText,
        confidence: bestConfidence,
      });
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      if (SpeechRecognition) {
        retryRecognition = new SpeechRecognition();
        retryRecognition.lang = "en-US";
        retryRecognition.interimResults = false;
        retryRecognition.continuous = false;
        retryRecognition.onresult = (event) => {
          const result = event.results?.[0]?.[0];
          bestText = result?.transcript || "";
          bestConfidence = result?.confidence || 0;
        };
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream?.getTracks().forEach((track) => track.stop());
        finish();
      };
      recorder.start();
      retryRecognition?.start();

      window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, timeoutMs);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      finish();
    }
  });
}

async function decodeRetryAudio(blob) {
  if (!blob || !recordingAudioContext) return null;

  try {
    return await recordingAudioContext.decodeAudioData(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

async function recordWordRetry(row, card) {
  const retry = card.querySelector(".retry-result");
  const score = card.querySelector(".drill-score");

  retry.textContent = `Say "${row.expected}" now...`;
  const result = await recordRetryAudio();
  const retryScore = scoreRetryWord(row.expected, result.text);
  const replacementAudioBuffer = await decodeRetryAudio(result.blob);

  if (replacementAudioBuffer) {
    row.replacementAudioBuffer = replacementAudioBuffer;
    row.spoken = retryScore.spoken;
    const currentRow = wordAnalysis.find((item) => item.id === row.id);
    if (currentRow) {
      currentRow.replacementAudioBuffer = replacementAudioBuffer;
      currentRow.spoken = retryScore.spoken;
    }
    updateRebuiltPhrasePlayer();
  }

  score.textContent = retryScore.pronunciation.toString();
  score.className = `drill-score ${metricClass(retryScore.pronunciation)}`;
  retry.textContent = replacementAudioBuffer
    ? `new: ${retryScore.spoken}. retry pronunciation ${retryScore.pronunciation}, accuracy ${retryScore.accuracy}.`
    : `heard: ${retryScore.spoken}. retry pronunciation ${retryScore.pronunciation}, accuracy ${retryScore.accuracy}.`;

  if (retryScore.pronunciation < 82) {
    await speakModelWord(row.expected, 0.72);
  }
}

async function runNewDrillForWord(row) {
  if (!row.replacementAudioBuffer || !recordingAudioContext) {
    drillStatus.textContent = `No new recording for "${row.expected}" yet. Use Record again first.`;
    return;
  }

  drillStatus.textContent = `New segment: ${row.spoken}. Model: ${row.expected}.`;
  const source = recordingAudioContext.createBufferSource();
  source.buffer = row.replacementAudioBuffer;
  source.connect(recordingAudioContext.destination);
  stopActiveRecordingSegment();
  activeSegmentSource = source;

  await new Promise((resolve) => {
    source.onended = resolve;
    recordingAudioContext.resume().then(() => source.start());
  });
  activeSegmentSource = null;
  await new Promise((resolve) => window.setTimeout(resolve, 220));
  await speakModelWord(row.expected);
}

async function runDrillForWord(row) {
  drillStatus.textContent = `Your segment (${row.timingSource}): ${row.spoken}. Model: ${row.expected}.`;

  if (row.startTime !== null && row.endTime !== null) {
    const played = await playRecordingSegment(row.startTime, row.endTime);
    if (!played) {
      drillStatus.textContent = `Could not play your segment. Model: ${row.expected}.`;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 220));
  } else {
    drillStatus.textContent = `No recorded segment for "${row.expected}". Listen to the model word.`;
  }

  await speakModelWord(row.expected);
}

function resetPronunciationAnalysis() {
  paceMetric.textContent = "--";
  pronunciationMetric.textContent = "--";
  accuracyMetric.textContent = "--";
  fluencyMetric.textContent = "--";
  stopActiveRecordingSegment();
  recordingAudioContext?.close();
  recordingAudioContext = null;
  latestRecordingAudioBuffer = null;
  if (rebuiltPhraseUrl) {
    URL.revokeObjectURL(rebuiltPhraseUrl);
    rebuiltPhraseUrl = null;
  }
  if (rebuiltPhrasePlayer) {
    rebuiltPhrasePlayer.removeAttribute("src");
    rebuiltPhrasePlayer.hidden = true;
  }
  if (rebuiltPhraseStatus) {
    rebuiltPhraseStatus.textContent = "Record words again to build an updated phrase.";
  }
  wordAnalysis = [];
  latestSpeechWindow = null;
  latestTranscriptionWords = [];
  latestAudioAnalysis = null;
  latestPhonemeAlignment = null;
  voiceTimeMetric.textContent = "--";
  silenceMetric.textContent = "--";
  pauseMetric.textContent = "--";
  volumeMetric.textContent = "--";
  stabilityMetric.textContent = "--";
  clippingMetric.textContent = "--";
  audioAnalysisSummary.textContent = "Recording new audio sample...";
  audioAnalysisTips.textContent = "";
  phonemeAnalysisSummary.textContent = "Waiting for recording...";
  phonemeAnalysisList.textContent = "";
  wordAnalysisList.textContent = "";
  drillWordList.textContent = "";
  wordAnalysisSummary.textContent = "Record speech to see word scores.";
  drillStatus.textContent = "Recording new attempt...";
  startDrillBtn.disabled = true;
}

async function runDrillQueue() {
  const problemRows = wordAnalysis.filter((row) => row.needsDrill);
  const drillRows = (problemRows.length ? problemRows : wordAnalysis).slice(0, 12);
  if (!drillRows.length) return;

  startDrillBtn.disabled = true;

  for (const row of drillRows) {
    drillStatus.textContent = `Drilling "${row.expected}"`;
    await runDrillForWord(row);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
  }

  drillStatus.textContent = "Drill finished. Record again to check improvement.";
  startDrillBtn.disabled = false;
}

function renderFeedback(durationMs) {
  const durationMinutes = Math.max(durationMs / 60000, 1 / 60);
  const comparison = compareWords(sourceText.value, transcript);
  const pace = Math.round(comparison.spokenCount / durationMinutes);
  const coverageScore = Math.round(comparison.coverage * 100);
  const paceScore = scorePace(pace);
  const analysis = buildWordAnalysis(sourceText.value, transcript, durationMs);
  const score = transcript ? Math.round(coverageScore * 0.72 + paceScore * 0.28) : 45;

  practiceScore.textContent = score.toString();
  paceMetric.textContent = `${analysis.summary.pace} wpm`;
  pronunciationMetric.textContent = `${analysis.summary.pronunciation}%`;
  accuracyMetric.textContent = `${analysis.summary.accuracy}%`;
  fluencyMetric.textContent = `${analysis.summary.fluency}%`;
  scoreSummary.textContent = transcript
    ? `Text match: ${coverageScore}%. Pace: ${pace} words per minute.`
    : "Recording saved, but the browser did not return recognized text.";
  renderWordAnalysis(analysis);

  const tips = [];

  if (!transcript) {
    tips.push("For full feedback, open the service in Chrome or Edge and allow microphone access.");
  }

  if (comparison.missing.length) {
    tips.push(`Repeat words that were not recognized confidently: ${comparison.missing.join(", ")}.`);
  }

  if (pace < 95) {
    tips.push("The pace is slow: link short function words with nearby words to sound more natural.");
  } else if (pace > 165) {
    tips.push("The pace is fast: pause after meaning groups and finish word endings more clearly.");
  } else {
    tips.push("The pace is good: now focus on stress in the key words of the phrase.");
  }

  if (comparison.coverage < 0.65 && transcript) {
    tips.push("Practice the phrase in parts first: 5-8 words, listen, then repeat.");
  }

  feedbackList.innerHTML = tips.map((tip) => `<li>${tip}</li>`).join("");
}

async function toggleRecording() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    stopRecognition();
    stopTimer();
    recordBtn.classList.remove("is-recording");
    recordBtn.textContent = "Record speech";
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  resetPronunciationAnalysis();
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size) audioChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    const durationMs = Date.now() - recordingStartedAt;
    latestRecordingDurationMs = durationMs;
    const blob = new Blob(audioChunks, { type: "audio/webm" });
    recordingPlayer.src = URL.createObjectURL(blob);
    recordingPlayer.hidden = false;
    playRecordingBtn.disabled = false;
    drillStatus.textContent = "Analyzing voice timing...";
    await prepareRecordingAudioBuffer(blob);
    const audioAnalysis = await analyzeAudioSignal(blob);
    renderAudioAnalysis(audioAnalysis);
    latestSpeechWindow = audioAnalysis?.speechWindow || (await detectSpeechWindow(blob));
    const browserTranscript = transcript;
    const browserScore = scoreTranscriptCandidate(sourceText.value, browserTranscript);
    try {
      drillStatus.textContent = "Transcribing locally with Vosk...";
      const localTranscription = await transcribeWithLocalAsr(blob);
      if (localTranscription.text.trim()) {
        transcript = localTranscription.text;
        transcriptConfidence = 0.78;
        latestTranscriptionWords = localTranscription.words;
        drillStatus.textContent = localTranscription.words.length
          ? "Local Vosk transcript selected with word timestamps."
          : "Local Vosk transcript selected.";
        transcriptText.textContent = transcript;
      }
    } catch {
      drillStatus.textContent = "Local Vosk ASR unavailable. Trying optional Speech API...";
      try {
      const apiTranscription = await transcribeWithSpeechApi(blob);
      if (apiTranscription.text.trim()) {
        const apiScore = scoreTranscriptCandidate(sourceText.value, apiTranscription.text);
        const apiIsBetter = apiScore >= browserScore + 0.04 || !browserTranscript.trim();
        latestTranscriptionWords = apiTranscription.words;

        if (apiIsBetter) {
          transcript = apiTranscription.text;
          transcriptConfidence = 0.86;
          drillStatus.textContent = apiTranscription.words.length
            ? "Speech API transcript selected with word timestamps."
            : "Speech API transcript selected.";
        } else {
          transcript = browserTranscript;
          drillStatus.textContent = apiTranscription.words.length
            ? "Browser transcript was closer. Using Speech API word timings for drill playback."
            : "Browser transcript was closer to the practice text.";
        }

        transcriptText.textContent = transcript;
      }
      } catch {
        drillStatus.textContent = "Using browser recognition fallback.";
      }
    }
    stream.getTracks().forEach((track) => track.stop());
    renderFeedback(durationMs);
    runPhonemeAlignment(blob);
  };

  mediaRecorder.start();
  startRecognition();
  startTimer();
  recordBtn.classList.add("is-recording");
  recordBtn.textContent = "Stop recording";
}

function updateSupportStatus() {
  const speech = Boolean(window.speechSynthesis);
  const mic = Boolean(navigator.mediaDevices?.getUserMedia);
  const recognition = Boolean(SpeechRecognition);
  const supported = [speech, mic, recognition].filter(Boolean).length;
  supportStatus.textContent = `${supported}/3 APIs available`;
}

async function readUploadedFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const isPdf = extension === "pdf" || file.type === "application/pdf";
  return isPdf ? extractTextFromPdf(file) : extractTextFromFile(file.name, await file.text());
}

function activateScreen(screenId) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.screen === screenId;
    button.classList.toggle("is-active", isActive);
  });

  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === screenId);
  });

  stopSpeech();
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateScreen(button.dataset.screen));
});

sourceText.addEventListener("input", updateTextStats);
readerText.addEventListener("input", updateReaderTextStats);

readerFileInput.addEventListener("change", async () => {
  const file = readerFileInput.files?.[0];
  if (!file) return;

  readerFileName.textContent = `Loading ${file.name}...`;
  readerCurrentText.textContent = "Reading file...";

  try {
    const extractedText = await readUploadedFile(file);

    if (!extractedText.trim()) {
      throw new Error("No readable text found in this file.");
    }

    readerText.value = extractedText;
    readerFileName.textContent = file.name;
    readerCurrentText.textContent = "File loaded. Start playback to see the current phrase.";
    updateReaderTextStats();
  } catch (error) {
    readerFileName.textContent = `Could not read ${file.name}`;
    readerCurrentText.textContent =
      error instanceof Error ? error.message : "Could not read the selected file.";
  }
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  fileName.textContent = `Loading ${file.name}...`;

  try {
    const extractedText = await readUploadedFile(file);

    if (!extractedText.trim()) {
      throw new Error("No readable text found in this file.");
    }

    sourceText.value = extractedText;
    fileName.textContent = file.name;
    updateTextStats();
  } catch (error) {
    fileName.textContent = `Could not read ${file.name}`;
    transcriptText.textContent =
      error instanceof Error ? error.message : "Could not read the selected file.";
  }
});

readerSpeakBtn.addEventListener("click", speakReaderText);
readerPauseBtn.addEventListener("click", pauseSpeech);
readerStopBtn.addEventListener("click", stopSpeech);
speakBtn.addEventListener("click", speakText);
pauseBtn.addEventListener("click", pauseSpeech);
stopBtn.addEventListener("click", stopSpeech);
startDrillBtn.addEventListener("click", runDrillQueue);
recordBtn.addEventListener("click", () => {
  toggleRecording().catch(() => {
    recordBtn.classList.remove("is-recording");
    recordBtn.textContent = "Record speech";
    transcriptText.textContent = "Could not access the microphone.";
    stopTimer();
  });
});
playRecordingBtn.addEventListener("click", () => recordingPlayer.play());

if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

updateTextStats();
updateReaderTextStats();
updateSupportStatus();
