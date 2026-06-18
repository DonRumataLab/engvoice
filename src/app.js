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
const chunkToggle = document.querySelector("#chunkToggle");
const chunkSummary = document.querySelector("#chunkSummary");
const chunkList = document.querySelector("#chunkList");
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
const waveformCanvas = document.querySelector("#waveformCanvas");
const waveformStatus = document.querySelector("#waveformStatus");
const waveformWordLabel = document.querySelector("#waveformWordLabel");
const waveStartBackBtn = document.querySelector("#waveStartBackBtn");
const waveStartForwardBtn = document.querySelector("#waveStartForwardBtn");
const waveEndBackBtn = document.querySelector("#waveEndBackBtn");
const waveEndForwardBtn = document.querySelector("#waveEndForwardBtn");
const wavePlayBtn = document.querySelector("#wavePlayBtn");
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
const pitchRangeMetric = document.querySelector("#pitchRangeMetric");
const endingToneMetric = document.querySelector("#endingToneMetric");
const rhythmMetric = document.querySelector("#rhythmMetric");
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
let latestAnalysisReferenceText = "";
let recordingAudioContext = null;
let activeSegmentSource = null;
let rebuiltPhraseUrl = null;
let wordAnalysis = [];
let selectedWaveformWordId = null;
let practiceChunks = [];
let activeChunkIndex = 0;
let chunkingEnabled = true;
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
  renderPracticeChunks();
}

function updateReaderTextStats() {
  renderTextStats(readerText, readerWordCount, readerReadTime, readerTargetPace);
}

function splitPracticeText(value, minWords = 5, maxWords = 8) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  const chunks = [];
  let current = [];

  const pushCurrent = () => {
    if (!current.length) return;
    chunks.push(current.join(" "));
    current = [];
  };

  sentences.forEach((sentence) => {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    words.forEach((word) => {
      current.push(word);
      if (current.length >= maxWords) pushCurrent();
    });

    if (current.length >= minWords) pushCurrent();
  });

  pushCurrent();
  return chunks;
}

function getActivePracticeText() {
  return practiceChunks[activeChunkIndex] || sourceText.value;
}

function getAnalysisReferenceText() {
  return latestAnalysisReferenceText || getActivePracticeText();
}

function renderPracticeChunks() {
  const previousText = practiceChunks[activeChunkIndex];
  const fullText = sourceText.value.replace(/\s+/g, " ").trim();
  practiceChunks = chunkingEnabled ? splitPracticeText(sourceText.value) : fullText ? [fullText] : [];
  const preservedIndex = previousText ? practiceChunks.indexOf(previousText) : -1;
  activeChunkIndex =
    preservedIndex >= 0 ? preservedIndex : Math.min(activeChunkIndex, Math.max(0, practiceChunks.length - 1));

  chunkList.textContent = "";
  practiceChunks.forEach((chunk, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chunk-button";
    button.classList.toggle("is-active", index === activeChunkIndex);
    button.textContent = chunk;
    button.addEventListener("click", () => {
      activeChunkIndex = index;
      renderPracticeChunks();
      resetPronunciationAnalysis();
      transcriptText.textContent = `Selected phrase ${index + 1}: ${chunk}`;
    });
    chunkList.append(button);
  });

  if (!practiceChunks.length) {
    chunkSummary.textContent = "No phrase selected";
  } else if (chunkingEnabled) {
    chunkSummary.textContent = `${activeChunkIndex + 1}/${practiceChunks.length} phrase selected`;
  } else {
    chunkSummary.textContent = "Full text selected";
  }
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
  speakTextFrom(getActivePracticeText(), { voiceSelect, rateInput, pitchInput });
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

function getExpectedWordTiming(wordIndex, wordCount, durationSeconds) {
  if (!wordCount) return null;

  const speechStart = latestSpeechWindow?.start ?? 0;
  const speechEnd = latestSpeechWindow?.end ?? durationSeconds;
  const speechDuration = Math.max(0.4, speechEnd - speechStart);
  const slotSeconds = speechDuration / wordCount;
  const start = speechStart + Math.max(0, wordIndex * slotSeconds - slotSeconds * 0.16);
  const end =
    speechStart + Math.min(speechDuration, (wordIndex + 1) * slotSeconds + slotSeconds * 0.2);

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

  const expectedWords = tokenize(getAnalysisReferenceText());
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

    const nextRow = {
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
      phonemeIssues: [],
    };
    nextRow.phonemeIssues = detectPhonemeIssues(nextRow);
    if (nextRow.phonemeIssues.length) nextRow.needsDrill = true;
    nextRows.push(nextRow);
  });

  if (alignmentWords.length > expectedWords.length) {
    alignmentWords.slice(expectedWords.length).forEach((alignmentWord, extraIndex) => {
      const index = expectedWords.length + extraIndex;
      const timing = getAlignmentWordTiming(alignmentWord, index, alignmentWords);
      if (timing) updated += 1;

      const nextRow = {
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
        phonemeIssues: [],
      };
      nextRow.phonemeIssues = detectPhonemeIssues(nextRow);
      if (nextRow.phonemeIssues.length) nextRow.needsDrill = true;
      nextRows.push(nextRow);
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

function getSelectedWaveformRow() {
  return wordAnalysis.find((row) => row.id === selectedWaveformWordId) || null;
}

function setWaveformControlsEnabled(enabled) {
  [
    waveStartBackBtn,
    waveStartForwardBtn,
    waveEndBackBtn,
    waveEndForwardBtn,
    wavePlayBtn,
  ].forEach((button) => {
    button.disabled = !enabled;
  });
}

function updateWaveformSelectionText() {
  const row = getSelectedWaveformRow();
  if (!row || !Number.isFinite(row.startTime) || !Number.isFinite(row.endTime)) {
    waveformWordLabel.textContent = "No word selected";
    setWaveformControlsEnabled(false);
    return;
  }

  waveformWordLabel.textContent = `${row.expected}: ${row.startTime.toFixed(2)}-${row.endTime.toFixed(2)}s`;
  setWaveformControlsEnabled(true);
}

function selectWaveformWord(rowId) {
  selectedWaveformWordId = rowId;
  document.querySelectorAll(".word-card").forEach((card) => {
    card.classList.toggle("is-selected", Number(card.dataset.wordId) === rowId);
  });
  updateWaveformSelectionText();
  drawWaveform();
}

function drawWaveform() {
  if (!waveformCanvas) return;

  const context = waveformCanvas.getContext("2d");
  const rect = waveformCanvas.getBoundingClientRect();
  const width = Math.max(360, Math.floor(rect.width || waveformCanvas.clientWidth || 900));
  const height = Number(waveformCanvas.getAttribute("height")) || 190;
  const pixelRatio = window.devicePixelRatio || 1;
  waveformCanvas.width = Math.floor(width * pixelRatio);
  waveformCanvas.height = Math.floor(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f7faf8";
  context.fillRect(0, 0, width, height);

  if (!latestRecordingAudioBuffer) {
    context.fillStyle = "#6d7975";
    context.font = "14px system-ui, sans-serif";
    context.fillText("Record speech to see the waveform.", 16, height / 2);
    waveformStatus.textContent = "Record speech to edit word boundaries.";
    updateWaveformSelectionText();
    return;
  }

  const data = latestRecordingAudioBuffer.getChannelData(0);
  const duration = latestRecordingAudioBuffer.duration;
  const centerY = height / 2;
  const usableHeight = height - 36;
  const samplesPerPixel = Math.max(1, Math.floor(data.length / width));

  context.strokeStyle = "#1c7565";
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const start = x * samplesPerPixel;
    const end = Math.min(data.length, start + samplesPerPixel);
    let min = 1;
    let max = -1;
    for (let index = start; index < end; index += 1) {
      const sample = data[index];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    context.moveTo(x, centerY + min * usableHeight * 0.42);
    context.lineTo(x, centerY + max * usableHeight * 0.42);
  }
  context.stroke();

  wordAnalysis.forEach((row) => {
    if (!Number.isFinite(row.startTime) || !Number.isFinite(row.endTime)) return;

    const startX = Math.max(0, Math.min(width, (row.startTime / duration) * width));
    const endX = Math.max(startX + 2, Math.min(width, (row.endTime / duration) * width));
    const isSelected = row.id === selectedWaveformWordId;
    context.fillStyle = isSelected ? "rgba(28, 117, 101, 0.2)" : "rgba(34, 87, 184, 0.1)";
    context.fillRect(startX, 0, endX - startX, height);
    context.strokeStyle = isSelected ? "#1c7565" : "rgba(34, 87, 184, 0.65)";
    context.lineWidth = isSelected ? 2 : 1;
    context.beginPath();
    context.moveTo(startX, 0);
    context.lineTo(startX, height);
    context.moveTo(endX, 0);
    context.lineTo(endX, height);
    context.stroke();

    if (endX - startX > 34) {
      context.fillStyle = isSelected ? "#12312c" : "#44504c";
      context.font = "12px system-ui, sans-serif";
      context.fillText(row.expected.slice(0, 12), startX + 4, 17);
    }
  });

  waveformStatus.textContent = wordAnalysis.length
    ? "Click a word region, then move its boundaries if playback cuts badly."
    : "Waveform is ready. Word boundaries will appear after analysis.";
  updateWaveformSelectionText();
}

function adjustSelectedWaveformBoundary(boundary, deltaSeconds) {
  const row = getSelectedWaveformRow();
  if (!row || !latestRecordingAudioBuffer) return;

  const duration = latestRecordingAudioBuffer.duration;
  const minDuration = 0.12;
  const rowIndex = wordAnalysis.findIndex((item) => item.id === row.id);
  const previous = rowIndex > 0 ? wordAnalysis[rowIndex - 1] : null;
  const next = rowIndex >= 0 ? wordAnalysis[rowIndex + 1] : null;
  const previousEnd = Number.isFinite(previous?.endTime) ? previous.endTime : 0;
  const nextStart = Number.isFinite(next?.startTime) ? next.startTime : duration;

  if (boundary === "start") {
    const minStart = previousEnd;
    const maxStart = row.endTime - minDuration;
    if (minStart <= maxStart) {
      row.startTime = Math.max(minStart, Math.min(maxStart, row.startTime + deltaSeconds));
    }
  } else {
    const minEnd = row.startTime + minDuration;
    const maxEnd = nextStart;
    if (minEnd <= maxEnd) {
      row.endTime = Math.min(maxEnd, Math.max(minEnd, row.endTime + deltaSeconds));
    }
  }

  row.timingSource = "manual waveform timing";
  renderWordAnalysis({ rows: wordAnalysis });
  selectWaveformWord(row.id);
  updateRebuiltPhrasePlayer();
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
  const expectedCount = Math.max(expected.length, 1);
  const durationSeconds = durationMs / 1000;

  const rows = aligned.map((item, index) => {
    const similarity = wordSimilarity(item.expected, item.spoken);
    const exact = item.expected === item.spoken;
    const pronunciation = item.spoken
      ? Math.round(similarity * 82 + recognitionConfidence * 18)
      : 0;
    const accuracy = exact ? 100 : Math.round(similarity * 100);
    const fluency = item.spoken ? Math.round((paceScore + accuracy) / 2) : 0;
    const apiTiming =
      item.spokenIndex >= 0 && similarity >= 0.86 && Math.abs(item.spokenIndex - index) <= 1
        ? getApiWordTiming(item.spokenIndex, durationSeconds)
        : null;
    const expectedTiming = getExpectedWordTiming(index, expectedCount, durationSeconds);
    const startTime = apiTiming?.start ?? expectedTiming?.start ?? null;
    const endTime = apiTiming?.end ?? expectedTiming?.end ?? null;

    const row = {
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
      timingSource: apiTiming ? "trusted ASR timing" : "reference phrase timing",
      phonemes: [],
      phonemeIssues: [],
      needsDrill: !item.spoken || pronunciation < 82 || accuracy < 80,
    };
    row.phonemeIssues = detectPhonemeIssues(row);
    if (row.phonemeIssues.length) row.needsDrill = true;
    return row;
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

function normalizePhoneLabel(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/[^a-z]/g, "");
}

function getPhoneDuration(phonemes, candidates) {
  const candidateSet = new Set(candidates);
  const match = (phonemes || []).find((phone) => candidateSet.has(normalizePhoneLabel(phone.label)));
  return match && Number.isFinite(match.start) && Number.isFinite(match.end)
    ? Math.max(0, match.end - match.start)
    : null;
}

function hasExpectedFinalConsonant(word) {
  return /(?:[bcdfghjklmnpqrstvwxz]|ch|ck|dge|ge|sh|th|tch)$/i.test(word);
}

function getFinalConsonantLabel(word) {
  return word.match(/(?:tch|dge|ch|ck|ge|sh|th|[bcdfghjklmnpqrstvwxz])$/i)?.[0] || word.slice(-1);
}

function detectPhonemeIssues(row) {
  const expected = normalizeText(row.expected);
  const spoken = normalizeText(row.spoken);
  const phonemes = row.phonemes || [];
  const issues = [];
  const addIssue = (type, detail) => {
    if (!issues.some((issue) => issue.type === type)) issues.push({ type, detail });
  };

  if (!expected) return issues;

  const finalConsonant = getFinalConsonantLabel(expected);
  const spokenFinal = spoken.slice(-1);
  const wordDuration =
    Number.isFinite(row.startTime) && Number.isFinite(row.endTime)
      ? Math.max(0, row.endTime - row.startTime)
      : 0;
  const finalPhone = phonemes.at(-1);
  const finalPhoneDuration =
    finalPhone && Number.isFinite(finalPhone.start) && Number.isFinite(finalPhone.end)
      ? Math.max(0, finalPhone.end - finalPhone.start)
      : null;

  if (
    hasExpectedFinalConsonant(expected) &&
    spoken &&
    !spoken.endsWith(finalConsonant) &&
    expected.slice(-1) !== spokenFinal &&
    !spoken.endsWith(expected.slice(-2))
  ) {
    addIssue("final consonant", `Finish the final "${finalConsonant}" sound.`);
  } else if (
    hasExpectedFinalConsonant(expected) &&
    finalPhoneDuration !== null &&
    wordDuration > 0 &&
    finalPhoneDuration / wordDuration < 0.12
  ) {
    addIssue("final consonant", "The last consonant looks very short.");
  }

  if (expected.includes("th")) {
    const thDuration = getPhoneDuration(phonemes, ["th", "dh"]);
    const likelyThSubstitution =
      spoken &&
      (normalizeText(expected.replace(/th/g, "t")) === spoken ||
        normalizeText(expected.replace(/th/g, "d")) === spoken ||
        normalizeText(expected.replace(/th/g, "s")) === spoken ||
        normalizeText(expected.replace(/th/g, "z")) === spoken);
    if (likelyThSubstitution || (phonemes.length > 0 && thDuration === null)) {
      addIssue("weak th", "Put the tongue lightly between the teeth for th.");
    } else if (thDuration < 0.05) {
      addIssue("weak th", "Hold th a little longer; it sounds too weak.");
    }
  }

  if (/[vw]/.test(expected)) {
    const expectedHasV = expected.includes("v");
    const expectedHasW = expected.includes("w");
    const spokenHasV = spoken.includes("v");
    const spokenHasW = spoken.includes("w");
    if ((expectedHasV && spokenHasW && !spokenHasV) || (expectedHasW && spokenHasV && !spokenHasW)) {
      addIssue("v/w", expectedHasV ? "Use voiced v with teeth on lip." : "Round lips for w; do not bite the lip.");
    }
  }

  if (expected.includes("r")) {
    const rDuration = getPhoneDuration(phonemes, ["r", "er"]);
    if (rDuration !== null && rDuration > 0.22) {
      addIssue("r color", "Shorten and relax r; avoid a hard rolled sound.");
    } else if (spoken && !spoken.includes("r") && expected.includes("r")) {
      addIssue("r color", "Keep the English r present without rolling it.");
    }
  }

  const stressedVowels = phonemes.filter((phone) => /[12]/.test(String(phone.label || "")));
  if (phonemes.length && expected.length >= 6 && !stressedVowels.length) {
    addIssue("stress", "Stress is unclear; make the main syllable stronger.");
  } else if (stressedVowels.length) {
    const longestStressed = Math.max(
      ...stressedVowels.map((phone) => Math.max(0, Number(phone.end) - Number(phone.start))),
    );
    if (longestStressed < 0.08) {
      addIssue("stress", "Lengthen the stressed vowel slightly.");
    }
  }

  if (!issues.length && (row.pronunciation < 76 || row.accuracy < 72)) {
    addIssue("unclear sound", "Compare the word slowly with the model pronunciation.");
  }

  return issues.slice(0, 3);
}

const minimalPairCatalog = [
  {
    words: ["ship", "sheep"],
    focus: "short /I/ vs long /i:/",
    hint: "Keep ship short and relaxed; make sheep longer and tenser.",
    issueTypes: ["stress"],
  },
  {
    words: ["bit", "beat"],
    focus: "short /I/ vs long /i:/",
    hint: "Bit is short; beat has a longer vowel.",
    issueTypes: ["stress"],
  },
  {
    words: ["bad", "bed"],
    focus: "/ae/ vs /e/",
    hint: "Open the mouth wider for bad; keep bed shorter and flatter.",
    issueTypes: [],
  },
  {
    words: ["walk", "work"],
    focus: "/ɔ:/ vs /ɜ:r/",
    hint: "Walk has an open rounded vowel; work needs the English r-colored vowel.",
    issueTypes: ["r color"],
  },
  {
    words: ["full", "fool"],
    focus: "/ʊ/ vs /u:/",
    hint: "Full is short and relaxed; fool is longer and rounded.",
    issueTypes: ["stress"],
  },
  {
    words: ["live", "leave"],
    focus: "short /I/ vs long /i:/",
    hint: "Live is short; leave is longer and smoother.",
    issueTypes: [],
  },
  {
    words: ["thin", "sin"],
    focus: "th vs s",
    hint: "For thin, put the tongue lightly between the teeth; sin keeps the tongue behind the teeth.",
    issueTypes: ["weak th"],
  },
  {
    words: ["then", "den"],
    focus: "voiced th vs d",
    hint: "Then starts with voiced th; den starts with a clear d stop.",
    issueTypes: ["weak th"],
  },
  {
    words: ["vine", "wine"],
    focus: "v vs w",
    hint: "V uses teeth on the lower lip; w starts with rounded lips.",
    issueTypes: ["v/w"],
  },
  {
    words: ["vest", "west"],
    focus: "v vs w",
    hint: "Bite the lower lip lightly for vest; round the lips for west.",
    issueTypes: ["v/w"],
  },
  {
    words: ["right", "light"],
    focus: "r vs l",
    hint: "Right uses English r without rolling; light touches the ridge behind the teeth.",
    issueTypes: ["r color"],
  },
  {
    words: ["back", "bag"],
    focus: "final k vs final g",
    hint: "Finish the last consonant clearly; k is voiceless, g is voiced.",
    issueTypes: ["final consonant"],
  },
  {
    words: ["cap", "cab"],
    focus: "final p vs final b",
    hint: "Close the lips for the final consonant; b stays voiced.",
    issueTypes: ["final consonant"],
  },
];

function getMinimalPairExercise(row) {
  const expected = normalizeText(row.expected);
  const spoken = normalizeText(row.spoken);
  const issueTypes = new Set((row.phonemeIssues || []).map((issue) => issue.type));

  return (
    minimalPairCatalog.find((pair) => pair.words.includes(expected) || pair.words.includes(spoken)) ||
    minimalPairCatalog.find((pair) => pair.issueTypes.some((issueType) => issueTypes.has(issueType))) ||
    null
  );
}

async function speakMinimalPair(pair) {
  for (const word of pair.words) {
    await speakModelWord(word, 0.84);
    await new Promise((resolve) => window.setTimeout(resolve, 260));
  }
}

function createMinimalPairExercise(row) {
  const pair = getMinimalPairExercise(row);
  if (!pair) return null;

  const exercise = document.createElement("div");
  exercise.className = "minimal-pair-exercise";

  const title = document.createElement("strong");
  title.textContent = `Minimal pair: ${(pair.labels || pair.words).join(" / ")}`;

  const hint = document.createElement("small");
  hint.textContent = `${pair.focus}. ${pair.hint}`;

  const actions = document.createElement("div");
  actions.className = "minimal-pair-actions";
  pair.words.forEach((word, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = pair.labels?.[index] || word;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      speakModelWord(word, 0.84);
    });
    actions.append(button);
  });

  const contrastButton = document.createElement("button");
  contrastButton.type = "button";
  contrastButton.textContent = "Contrast";
  contrastButton.addEventListener("click", (event) => {
    event.stopPropagation();
    speakMinimalPair(pair);
  });
  actions.append(contrastButton);

  exercise.append(title, hint, actions);
  return exercise;
}

function createPhonemeIssueList(row) {
  const issues = row.phonemeIssues || [];
  if (!issues.length) return null;

  const list = document.createElement("div");
  list.className = "phoneme-issue-list";
  issues.forEach((issue) => {
    const chip = document.createElement("span");
    chip.className = "phoneme-issue";
    chip.title = issue.detail;
    chip.textContent = issue.type;
    list.append(chip);
  });
  const detail = document.createElement("small");
  detail.className = "phoneme-issue-detail";
  detail.textContent = issues.map((issue) => issue.detail).join(" ");
  list.append(detail);
  return list;
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

function getWordEnergy(row) {
  if (
    !latestRecordingAudioBuffer ||
    !Number.isFinite(row.startTime) ||
    !Number.isFinite(row.endTime) ||
    row.endTime <= row.startTime
  ) {
    return 0;
  }

  const channel = latestRecordingAudioBuffer.getChannelData(0);
  const sampleRate = latestRecordingAudioBuffer.sampleRate;
  const start = Math.max(0, Math.floor(row.startTime * sampleRate));
  const end = Math.min(channel.length, Math.ceil(row.endTime * sampleRate));
  let sum = 0;

  for (let index = start; index < end; index += 1) {
    sum += channel[index] * channel[index];
  }

  return Math.sqrt(sum / Math.max(1, end - start));
}

function getPhraseStressWordId(rows) {
  const candidates = rows
    .filter((row) => Number.isFinite(row.startTime) && Number.isFinite(row.endTime))
    .map((row) => ({ row, energy: getWordEnergy(row) }))
    .filter((item) => item.energy > 0);
  if (!candidates.length) return null;

  const strongest = candidates.sort((a, b) => b.energy - a.energy)[0];
  return strongest.row.id;
}

function renderWordAnalysis(analysis) {
  wordAnalysis = analysis.rows;
  const phraseStressWordId = getPhraseStressWordId(wordAnalysis);
  if (!wordAnalysis.some((row) => row.id === selectedWaveformWordId)) {
    selectedWaveformWordId = wordAnalysis[0]?.id ?? null;
  }
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
    card.dataset.wordId = row.id;
    card.classList.toggle("is-selected", row.id === selectedWaveformWordId);
    card.addEventListener("click", () => selectWaveformWord(row.id));

    const wordBlock = document.createElement("div");
    const expected = document.createElement("strong");
    expected.textContent = row.expected;
    const heard = document.createElement("small");
    heard.textContent = `heard: ${row.spoken}`;
    wordBlock.append(expected, heard);
    if (row.id === phraseStressWordId) {
      const stressBadge = document.createElement("span");
      stressBadge.className = "phrase-stress-badge";
      stressBadge.textContent = "phrase stress";
      wordBlock.append(stressBadge);
    }
    const phonemeIssues = createPhonemeIssueList(row);
    if (phonemeIssues) wordBlock.append(phonemeIssues);
    const minimalPairExercise = createMinimalPairExercise(row);
    if (minimalPairExercise && (row.needsDrill || row.phonemeIssues?.length)) {
      wordBlock.append(minimalPairExercise);
    }
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
  drawWaveform();
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
  const phonemeIssues = createPhonemeIssueList(row);
  const minimalPairExercise = createMinimalPairExercise(row);

  const status = document.createElement("span");
  status.className = `drill-status-badge ${row.needsDrill ? "needs-drill" : "is-clear"}`;
  status.textContent = row.needsDrill ? "needs practice" : "checked";

  main.append(word, status, phonetic, heard, timing);
  if (phonemeIssues) main.append(phonemeIssues);
  if (minimalPairExercise) main.append(minimalPairExercise);

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
    drawWaveform();
  } catch {
    latestRecordingAudioBuffer = null;
    drawWaveform();
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

function estimateFramePitch(channel, start, end, sampleRate) {
  const length = end - start;
  if (length < 64) return null;

  let rms = 0;
  for (let index = start; index < end; index += 1) {
    rms += channel[index] * channel[index];
  }
  rms = Math.sqrt(rms / length);
  if (rms < 0.012) return null;

  const minLag = Math.floor(sampleRate / 420);
  const maxLag = Math.min(Math.floor(sampleRate / 75), Math.floor(length * 0.82));
  let bestLag = 0;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;
    const limit = length - lag;

    for (let offset = 0; offset < limit; offset += 1) {
      const a = channel[start + offset];
      const b = channel[start + offset + lag];
      correlation += a * b;
      energyA += a * a;
      energyB += b * b;
    }

    const normalized = correlation / Math.sqrt(Math.max(energyA * energyB, 1e-9));
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (!bestLag || bestCorrelation < 0.48) return null;
  return sampleRate / bestLag;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function analyzePitchContour(frames, channel, sampleRate, speechWindow) {
  const voicedFrames = frames
    .filter((frame) => !speechWindow || (frame.start >= speechWindow.start && frame.end <= speechWindow.end))
    .map((frame) => {
      const start = Math.floor(frame.start * sampleRate);
      const end = Math.min(channel.length, Math.floor(frame.end * sampleRate));
      return {
        ...frame,
        pitch: estimateFramePitch(channel, start, end, sampleRate),
      };
    })
    .filter((frame) => Number.isFinite(frame.pitch));

  if (voicedFrames.length < 4) {
    return {
      contour: "limited",
      ending: "unknown",
      rangeSemitones: 0,
      rhythmScore: 0,
      pitchPoints: voicedFrames,
    };
  }

  const pitches = voicedFrames.map((frame) => frame.pitch);
  const centerPitch = median(pitches);
  const filtered = voicedFrames.filter(
    (frame) => frame.pitch >= centerPitch * 0.55 && frame.pitch <= centerPitch * 1.75,
  );
  const usable = filtered.length >= 4 ? filtered : voicedFrames;
  const usablePitches = usable.map((frame) => frame.pitch);
  const lowPitch = Math.min(...usablePitches);
  const highPitch = Math.max(...usablePitches);
  const rangeSemitones = Math.round(12 * Math.log2(highPitch / Math.max(lowPitch, 1)));
  const splitIndex = Math.max(1, Math.floor(usable.length * 0.7));
  const earlyPitch = median(usable.slice(0, Math.max(1, Math.floor(usable.length * 0.3))).map((frame) => frame.pitch));
  const latePitch = median(usable.slice(splitIndex).map((frame) => frame.pitch));
  const endingChangeSemitones = 12 * Math.log2(latePitch / Math.max(earlyPitch, 1));
  const ending =
    endingChangeSemitones > 1.6
      ? "rising"
      : endingChangeSemitones < -1.6
        ? "falling"
        : "flat";

  let pitchJumps = 0;
  let totalStep = 0;
  for (let index = 1; index < usable.length; index += 1) {
    const step = Math.abs(12 * Math.log2(usable[index].pitch / Math.max(usable[index - 1].pitch, 1)));
    totalStep += step;
    if (step > 3.2) pitchJumps += 1;
  }
  const averageStep = totalStep / Math.max(1, usable.length - 1);
  const rhythmScore = Math.max(0, Math.min(100, Math.round(100 - averageStep * 18 - pitchJumps * 5)));
  const contour =
    rangeSemitones < 3
      ? "flat"
      : pitchJumps >= Math.max(3, usable.length * 0.18)
        ? "choppy"
        : "varied";

  return {
    contour,
    ending,
    endingChangeSemitones,
    rangeSemitones,
    rhythmScore,
    pitchPoints: usable,
  };
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
    const pitchAnalysis = analyzePitchContour(frames, channel, sampleRate, speechWindow);

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
      ...pitchAnalysis,
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
  const referenceText = getAnalysisReferenceText();
  const expectsQuestionTone = /\?\s*$/.test(referenceText.trim());
  const tips = [];

  voiceTimeMetric.textContent = `${analysis.voiceTime.toFixed(1)}s`;
  silenceMetric.textContent = `${silencePercent}%`;
  pauseMetric.textContent = analysis.pauseCount.toString();
  volumeMetric.textContent = `${volumePercent}%`;
  stabilityMetric.textContent = `${analysis.stability}%`;
  clippingMetric.textContent = `${clippingPercent}%`;
  pitchRangeMetric.textContent = analysis.rangeSemitones ? `${analysis.rangeSemitones} st` : "--";
  endingToneMetric.textContent = analysis.ending || "--";
  rhythmMetric.textContent = analysis.rhythmScore ? `${analysis.rhythmScore}%` : "--";
  audioAnalysisSummary.textContent = `Local signal score: ${analysis.signalScore}/100. Intonation: ${analysis.contour}.`;

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

  if (analysis.contour === "limited") {
    tips.push("Pitch contour is hard to read. Speak a little louder and keep the phrase connected.");
  } else {
    if (expectsQuestionTone && analysis.ending === "falling") {
      tips.push("This looks like a question, but the ending falls. Try a gentle rise on the final key word.");
    }

    if (!expectsQuestionTone && analysis.ending === "rising") {
      tips.push("The ending rises like a question. For statements, let the final tone fall more confidently.");
    }

    if (analysis.contour === "flat") {
      tips.push("Intonation is very flat. Add pitch movement on the main content words.");
    }

    if (analysis.contour === "choppy" || analysis.rhythmScore < 55) {
      tips.push("Pitch movement is choppy. Link words into smoother thought groups.");
    }

    if (analysis.rangeSemitones > 0 && analysis.rangeSemitones < 4) {
      tips.push("Pitch range is narrow. Make stressed words slightly higher or longer.");
    }
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

async function transcribeWithSpeechApi(blob, referenceText = getAnalysisReferenceText()) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "en");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const prompt = cleanSpeechText(referenceText).slice(0, 800);
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

async function alignPhonemesWithMfa(blob, referenceText = getAnalysisReferenceText()) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");
  formData.append("referenceText", cleanSpeechText(referenceText));

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

  alignment.words.forEach((word, index) => {
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

    const matchedRow =
      wordAnalysis[index] ||
      wordAnalysis.find((row) => normalizeText(row.expected) === normalizeText(word.label));
    const issueList = createPhonemeIssueList(matchedRow || { phonemeIssues: [] });
    if (issueList) {
      card.append(header, phones, issueList);
    } else {
      card.append(header, phones);
    }
    phonemeAnalysisList.append(card);
  });
}

async function runPhonemeAlignment(blob, referenceText = getAnalysisReferenceText()) {
  phonemeAnalysisSummary.textContent = "Running self-hosted MFA phoneme alignment...";
  phonemeAnalysisList.textContent = "";

  try {
    renderPhonemeAlignment(await alignPhonemesWithMfa(blob, referenceText));
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
    row.phonemeIssues = detectPhonemeIssues(row);
    const currentRow = wordAnalysis.find((item) => item.id === row.id);
    if (currentRow) {
      currentRow.replacementAudioBuffer = replacementAudioBuffer;
      currentRow.spoken = retryScore.spoken;
      currentRow.phonemeIssues = detectPhonemeIssues(currentRow);
      currentRow.needsDrill = currentRow.needsDrill || currentRow.phonemeIssues.length > 0;
    }
    updateRebuiltPhrasePlayer();
  }

  score.textContent = retryScore.pronunciation.toString();
  score.className = `drill-score ${metricClass(retryScore.pronunciation)}`;
  const retryIssues = row.phonemeIssues?.length
    ? ` Focus: ${row.phonemeIssues.map((issue) => issue.type).join(", ")}.`
    : "";
  retry.textContent = replacementAudioBuffer
    ? `new: ${retryScore.spoken}. retry pronunciation ${retryScore.pronunciation}, accuracy ${retryScore.accuracy}.${retryIssues}`
    : `heard: ${retryScore.spoken}. retry pronunciation ${retryScore.pronunciation}, accuracy ${retryScore.accuracy}.${retryIssues}`;

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
  selectedWaveformWordId = null;
  latestAnalysisReferenceText = "";
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
  pitchRangeMetric.textContent = "--";
  endingToneMetric.textContent = "--";
  rhythmMetric.textContent = "--";
  audioAnalysisSummary.textContent = "Recording new audio sample...";
  audioAnalysisTips.textContent = "";
  phonemeAnalysisSummary.textContent = "Waiting for recording...";
  phonemeAnalysisList.textContent = "";
  wordAnalysisList.textContent = "";
  drillWordList.textContent = "";
  drawWaveform();
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
  const practiceText = getAnalysisReferenceText();
  const comparison = compareWords(practiceText, transcript);
  const pace = Math.round(comparison.spokenCount / durationMinutes);
  const coverageScore = Math.round(comparison.coverage * 100);
  const paceScore = scorePace(pace);
  const analysis = buildWordAnalysis(practiceText, transcript, durationMs);
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
    latestAnalysisReferenceText = getActivePracticeText();
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
    const browserScore = scoreTranscriptCandidate(latestAnalysisReferenceText, browserTranscript);
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
      const apiTranscription = await transcribeWithSpeechApi(blob, latestAnalysisReferenceText);
      if (apiTranscription.text.trim()) {
        const apiScore = scoreTranscriptCandidate(latestAnalysisReferenceText, apiTranscription.text);
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
    runPhonemeAlignment(blob, latestAnalysisReferenceText);
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
chunkToggle.addEventListener("change", () => {
  chunkingEnabled = chunkToggle.checked;
  activeChunkIndex = 0;
  renderPracticeChunks();
  resetPronunciationAnalysis();
  transcriptText.textContent = chunkingEnabled
    ? "Text splitting is on. Select a short phrase to practice."
    : "Text splitting is off. The full text will be used for practice.";
});
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
waveformCanvas.addEventListener("click", (event) => {
  if (!latestRecordingAudioBuffer || !wordAnalysis.length) return;

  const rect = waveformCanvas.getBoundingClientRect();
  const positionSeconds =
    ((event.clientX - rect.left) / Math.max(1, rect.width)) * latestRecordingAudioBuffer.duration;
  const exactRow = wordAnalysis.find(
    (row) =>
      Number.isFinite(row.startTime) &&
      Number.isFinite(row.endTime) &&
      positionSeconds >= row.startTime &&
      positionSeconds <= row.endTime,
  );
  const nearestRow =
    exactRow ||
    wordAnalysis
      .filter((row) => Number.isFinite(row.startTime) && Number.isFinite(row.endTime))
      .sort((a, b) => {
        const aCenter = (a.startTime + a.endTime) / 2;
        const bCenter = (b.startTime + b.endTime) / 2;
        return Math.abs(aCenter - positionSeconds) - Math.abs(bCenter - positionSeconds);
      })[0];

  if (nearestRow) selectWaveformWord(nearestRow.id);
});
waveStartBackBtn.addEventListener("click", () => adjustSelectedWaveformBoundary("start", -0.05));
waveStartForwardBtn.addEventListener("click", () => adjustSelectedWaveformBoundary("start", 0.05));
waveEndBackBtn.addEventListener("click", () => adjustSelectedWaveformBoundary("end", -0.05));
waveEndForwardBtn.addEventListener("click", () => adjustSelectedWaveformBoundary("end", 0.05));
wavePlayBtn.addEventListener("click", async () => {
  const row = getSelectedWaveformRow();
  if (!row) return;
  await runDrillForWord(row);
});
window.addEventListener("resize", drawWaveform);

if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

updateTextStats();
updateReaderTextStats();
updateSupportStatus();
drawWaveform();
