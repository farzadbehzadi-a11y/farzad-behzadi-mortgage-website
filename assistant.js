(() => {
  'use strict';

  // Custom chat/voice panel on the official ElevenLabs client SDK.
  // The SDK (~1 MB) is only fetched the first time a visitor opens the panel.
  const AGENT_ID = 'agent_3801kw5nbj8te98r33m4p8qepdnb';
  const SDK_URL = 'https://unpkg.com/@elevenlabs/client@1.28.0/dist/lib.iife.js';

  const root = document.querySelector('[data-assistant]');
  if (!root) return;

  const $ = selector => root.querySelector(selector);
  const panel = $('[data-assistant-panel]');
  const launcher = $('[data-assistant-launcher]');
  const launcherLabel = $('[data-assistant-launcher-label]');
  const closeButton = $('[data-assistant-close]');
  const endButton = $('[data-assistant-end]');
  const status = $('[data-assistant-status]');
  const startView = $('[data-assistant-start]');
  const notice = $('[data-assistant-notice]');
  const conversationView = $('[data-assistant-conversation]');
  const voiceView = $('[data-assistant-voice]');
  const orb = $('[data-assistant-orb]');
  const muteButton = $('[data-assistant-mute]');
  const log = $('[data-assistant-log]');
  const typing = $('[data-assistant-typing]');
  const composer = $('[data-assistant-composer]');
  const input = $('[data-assistant-input]');
  const sendButton = $('[data-assistant-send]');
  const endedView = $('[data-assistant-ended]');
  const endedText = $('[data-assistant-ended-text]');
  const restartButton = $('[data-assistant-restart]');

  const IDLE_STATUS = status.textContent;
  const PLACEHOLDERS = { en: 'Type your message…', fa: 'پیام خود را بنویسید…' };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let sdkPromise = null;
  let conversation = null;
  let mode = 'text';
  let phase = 'idle'; // idle | connecting | active | ended
  let muted = false;
  let meterFrame = 0;
  const pendingEchoes = [];

  root.hidden = false;

  function loadSdk() {
    if (window.ElevenLabsClient) return Promise.resolve(window.ElevenLabsClient);
    if (!sdkPromise) {
      sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SDK_URL;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = () => window.ElevenLabsClient ? resolve(window.ElevenLabsClient) : reject(new Error('SDK missing'));
        script.onerror = () => reject(new Error('SDK failed to load'));
        document.head.append(script);
      }).catch(err => { sdkPromise = null; throw err; });
    }
    return sdkPromise;
  }

  function language() {
    const checked = root.querySelector('input[name="assistant-language"]:checked');
    return checked ? checked.value : 'en';
  }

  // Voice responses carry delivery cues such as "[warmly]"; they are not meant to be read.
  function clean(text) {
    return String(text || '').replace(/\[[a-z][a-z' -]{0,30}\]\s*/gi, '').trim();
  }

  function setStatus(text) { status.textContent = text; }

  function setPhase(next) {
    phase = next;
    root.dataset.phase = next;
    const live = next === 'connecting' || next === 'active';
    startView.hidden = next !== 'idle';
    conversationView.hidden = next === 'idle';
    endedView.hidden = next !== 'ended';
    composer.hidden = next === 'ended';
    endButton.hidden = !live;
    voiceView.hidden = !(live && mode === 'voice');
    input.disabled = sendButton.disabled = next !== 'active';
    launcher.classList.toggle('is-live', live);
    launcherLabel.textContent = live ? 'Return to conversation' : 'Ask a question';
    if (next !== 'active') typing.hidden = true;
  }

  function addMessage(role, text) {
    const body = clean(text);
    if (!body) return;
    const item = document.createElement('div');
    item.className = `assistant-message is-${role}`;
    const who = document.createElement('span');
    who.className = 'visually-hidden';
    who.textContent = role === 'user' ? 'You: ' : 'Assistant: ';
    const bubble = document.createElement('p');
    bubble.dir = 'auto';
    bubble.textContent = body;
    item.append(who, bubble);
    log.append(item);
    log.scrollTop = log.scrollHeight;
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    loadSdk().catch(() => {}); // warm the SDK while the visitor reads the options
    const target = phase === 'active' ? input : panel.querySelector('input[name="assistant-language"]:checked');
    (target || closeButton).focus();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    launcher.focus();
  }

  function stopMeter() {
    cancelAnimationFrame(meterFrame);
    orb.style.removeProperty('--level');
  }

  // Scales the orb with whoever is talking; skipped when motion is reduced.
  function runMeter() {
    if (reducedMotion.matches || !conversation || mode !== 'voice') return;
    const level = root.dataset.speaker === 'agent' ? conversation.getOutputVolume() : conversation.getInputVolume();
    orb.style.setProperty('--level', Math.min(1, level * 1.6).toFixed(3));
    meterFrame = requestAnimationFrame(runMeter);
  }

  function finish(message) {
    stopMeter();
    conversation = null;
    muted = false;
    muteButton.setAttribute('aria-pressed', 'false');
    endedText.textContent = message;
    setStatus(IDLE_STATUS);
    setPhase('ended');
  }

  async function start(selectedMode) {
    if (phase === 'connecting' || phase === 'active') return;
    mode = selectedMode;
    root.dataset.mode = mode;
    root.dataset.speaker = 'user';
    notice.hidden = true;
    log.replaceChildren();
    pendingEchoes.length = 0;
    const lang = language();
    input.placeholder = PLACEHOLDERS[lang];
    setPhase('connecting');
    setStatus('Connecting…');

    try {
      const { Conversation } = await loadSdk();
      conversation = await Conversation.startSession({
        agentId: AGENT_ID,
        textOnly: mode === 'text',
        overrides: { agent: { language: lang } },
        onConnect: () => {
          setPhase('active');
          setStatus(mode === 'voice' ? 'Listening' : 'Online');
          if (mode === 'text') input.focus();
          runMeter();
        },
        onMessage: ({ message, source }) => {
          if (source === 'user') {
            const echo = pendingEchoes.indexOf(clean(message));
            if (echo !== -1) { pendingEchoes.splice(echo, 1); return; }
            addMessage('user', message);
          } else {
            typing.hidden = true;
            addMessage('agent', message);
          }
        },
        onModeChange: ({ mode: talking }) => {
          if (mode !== 'voice') return;
          root.dataset.speaker = talking === 'speaking' ? 'agent' : 'user';
          setStatus(talking === 'speaking' ? 'Speaking' : 'Listening');
        },
        onDisconnect: details => {
          if (phase === 'ended') return;
          const reason = details && details.reason;
          finish(reason === 'error' ? 'The connection dropped. Please start again.'
            : reason === 'agent' ? 'The assistant ended the conversation.'
            : 'Conversation ended.');
        },
        onError: () => {}
      });
    } catch (err) {
      conversation = null;
      stopMeter();
      setPhase('idle');
      setStatus(IDLE_STATUS);
      const micBlocked = mode === 'voice' && /permission|notallowed|denied|device/i.test(`${err && err.name} ${err && err.message}`);
      notice.textContent = micBlocked
        ? 'Microphone access is blocked. You can still send a message instead.'
        : 'The assistant is unavailable right now. Please try again, or call (604) 363-5353.';
      notice.hidden = false;
    }
  }

  async function end() {
    const active = conversation;
    finish('Conversation ended.');
    if (active) { try { await active.endSession(); } catch {} }
  }

  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  closeButton.addEventListener('click', closePanel);
  endButton.addEventListener('click', end);
  restartButton.addEventListener('click', () => {
    setPhase('idle');
    panel.querySelector('input[name="assistant-language"]:checked').focus();
  });
  root.querySelectorAll('[data-assistant-start-mode]').forEach(button => {
    button.addEventListener('click', () => start(button.dataset.assistantStartMode));
  });

  muteButton.addEventListener('click', () => {
    if (!conversation) return;
    muted = !muted;
    conversation.setMicMuted(muted);
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.setAttribute('aria-label', muted ? 'Unmute microphone' : 'Mute microphone');
  });

  composer.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !conversation || phase !== 'active') return;
    conversation.sendUserMessage(text);
    pendingEchoes.push(clean(text));
    addMessage('user', text);
    input.value = '';
    if (mode === 'text') typing.hidden = false;
  });

  input.addEventListener('input', () => { if (conversation) conversation.sendUserActivity(); });

  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closePanel();
    }
  });

  window.addEventListener('pagehide', () => { if (conversation) conversation.endSession(); });

  setPhase('idle');
})();
