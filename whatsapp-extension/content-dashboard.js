// Content Script - Dashboard
// Comunica entre a página do dashboard e o background

console.log('[Dashboard Extension] Content script carregado');

let isConnected = false;
const MAX_REGISTRATION_ATTEMPTS = 5;
let registrationAttempts = 0;

// Registra no background
function registerWithBackground() {
  chrome.runtime.sendMessage({ type: 'DASHBOARD_READY' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Dashboard Extension] Erro ao registrar:', chrome.runtime.lastError);
      registrationAttempts++;
      if (registrationAttempts < MAX_REGISTRATION_ATTEMPTS) {
        setTimeout(registerWithBackground, 1000);
      }
    } else {
      console.log('[Dashboard Extension] Registrado no background');
    }
  });
}

registerWithBackground();

// Escuta mensagens da página (dashboard)
window.addEventListener('message', async (event) => {
  // Ignora mensagens de outras origens
  if (event.source !== window) return;
  
  const { type, payload } = event.data || {};
  
  console.log('[Dashboard Extension] Recebeu mensagem da página:', type);

  // Ping do dashboard para verificar se extensão está ativa
  if (type === 'WHATSAPP_EXTENSION_PING') {
    window.postMessage({
      type: 'WHATSAPP_EXTENSION_READY',
      payload: { connected: isConnected }
    }, '*');
    return;
  }

  // Verifica conexão com WhatsApp
  if (type === 'WHATSAPP_CHECK_CONNECTION') {
    chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage({
          type: 'WHATSAPP_CONNECTION_STATUS',
          payload: { connected: false }
        }, '*');
      } else {
        isConnected = response?.connected || false;
        window.postMessage({
          type: 'WHATSAPP_CONNECTION_STATUS',
          payload: { connected: isConnected }
        }, '*');
      }
    });
    return;
  }

  // Comandos para o WhatsApp — aceita múltiplos formatos de tipo e extrai telefone com fallbacks
  const isCommand = type === 'WHATSAPP_OPEN_CHAT' || type === 'WHATSAPP_SEND_TEXT' || type === 'WHATSAPP_SEND_IMAGE'
    || type === 'WHATSAPP_EXTENSION_COMMAND' || type === 'OPEN_CHAT' || type === 'SEND_TEXT' || type === 'SEND_IMAGE';
  
  if (isCommand) {
    const raw = event.data || {};
    // Extract phone from any possible location
    const phone = payload?.phone || raw.phone || payload?.phoneNumber || raw.phoneNumber || payload?.number || raw.number;
    const text = payload?.text || raw.text;
    const imageUrl = payload?.imageUrl || raw.imageUrl || payload?.imageDataUrl || raw.imageDataUrl;
    // Determine action from type or action field
    const action = raw.action || raw.command || type.replace('WHATSAPP_', '');

    let command;
    if (action === 'OPEN_CHAT' || type === 'WHATSAPP_OPEN_CHAT' || type === 'OPEN_CHAT') {
      command = { type: 'OPEN_CHAT', phone };
    } else if (action === 'SEND_TEXT' || type === 'WHATSAPP_SEND_TEXT' || type === 'SEND_TEXT') {
      command = { type: 'SEND_TEXT', phone, text };
    } else if (action === 'SEND_IMAGE' || type === 'WHATSAPP_SEND_IMAGE' || type === 'SEND_IMAGE') {
      command = { type: 'SEND_IMAGE', phone, imageUrl };
    }

    if (!command || !phone) {
      console.warn('[Dashboard Extension] Comando sem telefone, ignorando:', type, raw);
      window.postMessage({
        type: 'WHATSAPP_RESPONSE',
        requestId: raw.requestId,
        payload: { success: false, error: 'Phone number missing' }
      }, '*');
      return;
    }

    console.log('[Dashboard Extension] Enviando comando para background:', command);

    // Timeout para a resposta
    const timeout = setTimeout(() => {
      window.postMessage({
        type: 'WHATSAPP_RESPONSE',
        payload: { success: false, error: 'Timeout - WhatsApp não respondeu' }
      }, '*');
    }, 30000);

    chrome.runtime.sendMessage(command, (response) => {
      clearTimeout(timeout);
      
      if (chrome.runtime.lastError) {
        console.error('[Dashboard Extension] Erro:', chrome.runtime.lastError);
        window.postMessage({
          type: 'WHATSAPP_RESPONSE',
          payload: { success: false, error: chrome.runtime.lastError.message }
        }, '*');
      } else {
        console.log('[Dashboard Extension] Resposta do background:', response);
        window.postMessage({
          type: 'WHATSAPP_RESPONSE',
          payload: response || { success: false, error: 'Sem resposta' }
        }, '*');
      }
    });
    return;
  }
});

// Escuta mensagens do background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Dashboard Extension] Mensagem do background:', message.type);
  
  if (message.type === 'WHATSAPP_CONNECTED') {
    isConnected = true;
    window.postMessage({
      type: 'WHATSAPP_CONNECTION_STATUS',
      payload: { connected: true }
    }, '*');
  }

  if (message.type === 'WHATSAPP_DISCONNECTED') {
    isConnected = false;
    window.postMessage({
      type: 'WHATSAPP_CONNECTION_STATUS',
      payload: { connected: false }
    }, '*');
  }

  sendResponse({ received: true });
  return true;
});

// Notifica a página que a extensão foi carregada
setTimeout(() => {
  window.postMessage({ type: 'WHATSAPP_EXTENSION_LOADED' }, '*');
}, 500);
