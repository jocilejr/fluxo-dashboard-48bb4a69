// Content Script - Dashboard
// Bridge between dashboard page and extension background

console.log('[Dashboard Extension] Content script carregado');

let isConnected = false;
const MAX_REGISTRATION_ATTEMPTS = 5;
let registrationAttempts = 0;

// Dedup for multi-protocol envelope (same requestId sent 2-3x)
const recentRequests = new Map();
const REQUEST_TTL_MS = 15000;

function markRequest(requestId) {
  if (!requestId) return;
  recentRequests.set(requestId, Date.now());
}

function isDuplicateRequest(requestId) {
  if (!requestId) return false;
  const now = Date.now();

  for (const [id, ts] of recentRequests.entries()) {
    if (now - ts > REQUEST_TTL_MS) recentRequests.delete(id);
  }

  return recentRequests.has(requestId);
}

function registerWithBackground() {
  chrome.runtime.sendMessage({ type: 'DASHBOARD_READY' }, () => {
    if (chrome.runtime.lastError) {
      console.error('[Dashboard Extension] Erro ao registrar:', chrome.runtime.lastError);
      registrationAttempts += 1;
      if (registrationAttempts < MAX_REGISTRATION_ATTEMPTS) {
        setTimeout(registerWithBackground, 1000);
      }
      return;
    }

    console.log('[Dashboard Extension] Registrado no background');
  });
}

registerWithBackground();

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const raw = event.data || {};
  const { type, payload } = raw;

  // Ping
  if (type === 'WHATSAPP_EXTENSION_PING') {
    window.postMessage(
      {
        type: 'WHATSAPP_EXTENSION_READY',
        payload: { connected: isConnected },
      },
      '*'
    );
    return;
  }

  // Connection check
  if (type === 'WHATSAPP_CHECK_CONNECTION') {
    chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage(
          {
            type: 'WHATSAPP_CONNECTION_STATUS',
            payload: { connected: false },
          },
          '*'
        );
        return;
      }

      isConnected = response?.connected || false;
      window.postMessage(
        {
          type: 'WHATSAPP_CONNECTION_STATUS',
          payload: { connected: isConnected },
        },
        '*'
      );
    });
    return;
  }

  const isCommand =
    type === 'WHATSAPP_OPEN_CHAT' ||
    type === 'WHATSAPP_SEND_TEXT' ||
    type === 'WHATSAPP_SEND_IMAGE' ||
    type === 'WHATSAPP_EXTENSION_COMMAND' ||
    type === 'OPEN_CHAT' ||
    type === 'SEND_TEXT' ||
    type === 'SEND_IMAGE';

  if (!isCommand) return;

  const requestId = raw.requestId;
  if (isDuplicateRequest(requestId)) {
    console.log('[Dashboard Extension] Comando duplicado ignorado:', requestId, type);
    return;
  }
  markRequest(requestId);

  const phone = payload?.phone || raw.phone || payload?.phoneNumber || raw.phoneNumber || payload?.number || raw.number;
  const text = payload?.text || raw.text;
  const imageUrl = payload?.imageUrl || raw.imageUrl || payload?.imageDataUrl || raw.imageDataUrl;
  const action = raw.action || raw.command || type.replace('WHATSAPP_', '');

  let command = null;
  if (action === 'OPEN_CHAT' || type === 'WHATSAPP_OPEN_CHAT' || type === 'OPEN_CHAT') {
    command = { type: 'OPEN_CHAT', phone };
  } else if (action === 'SEND_TEXT' || type === 'WHATSAPP_SEND_TEXT' || type === 'SEND_TEXT') {
    command = { type: 'SEND_TEXT', phone, text };
  } else if (action === 'SEND_IMAGE' || type === 'WHATSAPP_SEND_IMAGE' || type === 'SEND_IMAGE') {
    command = { type: 'SEND_IMAGE', phone, imageUrl };
  }

  if (!command || !phone) {
    window.postMessage(
      {
        type: 'WHATSAPP_RESPONSE',
        requestId,
        payload: { success: false, error: 'Phone number missing' },
      },
      '*'
    );
    return;
  }

  console.log('[Dashboard Extension] Enviando comando para background:', command);

  const timeout = setTimeout(() => {
    window.postMessage(
      {
        type: 'WHATSAPP_RESPONSE',
        requestId,
        payload: { success: false, error: 'Timeout - WhatsApp não respondeu' },
      },
      '*'
    );
  }, 30000);

  chrome.runtime.sendMessage(command, (response) => {
    clearTimeout(timeout);

    if (chrome.runtime.lastError) {
      window.postMessage(
        {
          type: 'WHATSAPP_RESPONSE',
          requestId,
          payload: { success: false, error: chrome.runtime.lastError.message },
        },
        '*'
      );
      return;
    }

    window.postMessage(
      {
        type: 'WHATSAPP_RESPONSE',
        requestId,
        payload: response || { success: false, error: 'Sem resposta' },
      },
      '*'
    );
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'WHATSAPP_CONNECTED') {
    isConnected = true;
    window.postMessage(
      {
        type: 'WHATSAPP_CONNECTION_STATUS',
        payload: { connected: true },
      },
      '*'
    );
  }

  if (message.type === 'WHATSAPP_DISCONNECTED') {
    isConnected = false;
    window.postMessage(
      {
        type: 'WHATSAPP_CONNECTION_STATUS',
        payload: { connected: false },
      },
      '*'
    );
  }

  sendResponse({ received: true });
  return true;
});

setTimeout(() => {
  window.postMessage({ type: 'WHATSAPP_EXTENSION_LOADED' }, '*');
}, 500);
