// Content Script - Dashboard (Lovable App)
// Comunicação entre a página web e a extensão

console.log('[Dashboard Extension] Content script carregado');

let isConnected = false;
let registrationAttempts = 0;
const MAX_REGISTRATION_ATTEMPTS = 5;

// Registra no background com retry
function registerWithBackground() {
  registrationAttempts++;
  console.log(`[Dashboard Extension] Tentativa de registro ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);
  
  chrome.runtime.sendMessage({ type: 'DASHBOARD_READY' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Dashboard Extension] Erro ao registrar:', chrome.runtime.lastError.message);
      if (registrationAttempts < MAX_REGISTRATION_ATTEMPTS) {
        setTimeout(registerWithBackground, 1000);
      }
    } else {
      console.log('[Dashboard Extension] Registrado no background:', response);
    }
  });
}

// Inicia registro
registerWithBackground();

// Escuta mensagens da página web (via postMessage)
window.addEventListener('message', async (event) => {
  // Ignora mensagens que não são da própria página
  if (event.source !== window) return;
  
  const { type, payload, requestId } = event.data || {};
  
  if (!type || !type.startsWith('WHATSAPP_')) return;
  
  console.log('[Dashboard Extension] Recebeu da página:', type, payload, 'requestId:', requestId);

  // Ping para verificar se extensão está ativa
  if (type === 'WHATSAPP_EXTENSION_PING') {
    window.postMessage({
      type: 'WHATSAPP_EXTENSION_READY',
      requestId
    }, '*');
    return;
  }

  // Verifica conexão com WhatsApp
  if (type === 'WHATSAPP_CHECK_CONNECTION') {
    chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Dashboard Extension] Erro PING:', chrome.runtime.lastError.message);
        window.postMessage({
          type: 'WHATSAPP_CONNECTION_STATUS',
          requestId,
          payload: { connected: false }
        }, '*');
        return;
      }
      window.postMessage({
        type: 'WHATSAPP_CONNECTION_STATUS',
        requestId,
        payload: { connected: response?.connected || false }
      }, '*');
    });
    return;
  }

  // Comandos para WhatsApp
  if (type === 'WHATSAPP_OPEN_CHAT') {
    const phone = payload?.phone;
    console.log('[Dashboard Extension] Enviando OPEN_CHAT para background, phone:', phone);
    
    chrome.runtime.sendMessage({
      type: 'OPEN_CHAT',
      phone: phone
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Dashboard Extension] Erro OPEN_CHAT:', chrome.runtime.lastError.message);
        window.postMessage({
          type: 'WHATSAPP_RESPONSE',
          requestId,
          payload: { success: false, error: chrome.runtime.lastError.message }
        }, '*');
        return;
      }
      console.log('[Dashboard Extension] Resposta OPEN_CHAT:', response);
      window.postMessage({
        type: 'WHATSAPP_RESPONSE',
        requestId,
        payload: response || { success: false }
      }, '*');
    });
    return;
  }

  if (type === 'WHATSAPP_SEND_TEXT') {
    const phone = payload?.phone;
    const text = payload?.text;
    console.log('[Dashboard Extension] Enviando SEND_TEXT para background, phone:', phone);
    
    chrome.runtime.sendMessage({
      type: 'SEND_TEXT',
      phone: phone,
      text: text
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Dashboard Extension] Erro SEND_TEXT:', chrome.runtime.lastError.message);
        window.postMessage({
          type: 'WHATSAPP_RESPONSE',
          requestId,
          payload: { success: false, error: chrome.runtime.lastError.message }
        }, '*');
        return;
      }
      console.log('[Dashboard Extension] Resposta SEND_TEXT:', response);
      window.postMessage({
        type: 'WHATSAPP_RESPONSE',
        requestId,
        payload: response || { success: false }
      }, '*');
    });
    return;
  }

  if (type === 'WHATSAPP_SEND_IMAGE') {
    const phone = payload?.phone;
    const imageUrl = payload?.imageDataUrl;
    console.log('[Dashboard Extension] Enviando SEND_IMAGE para background, phone:', phone);
    
    chrome.runtime.sendMessage({
      type: 'SEND_IMAGE',
      phone: phone,
      imageUrl: imageUrl
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Dashboard Extension] Erro SEND_IMAGE:', chrome.runtime.lastError.message);
        window.postMessage({
          type: 'WHATSAPP_RESPONSE',
          requestId,
          payload: { success: false, error: chrome.runtime.lastError.message }
        }, '*');
        return;
      }
      console.log('[Dashboard Extension] Resposta SEND_IMAGE:', response);
      window.postMessage({
        type: 'WHATSAPP_RESPONSE',
        requestId,
        payload: response || { success: false }
      }, '*');
    });
    return;
  }
});

// Escuta mensagens do background (status do WhatsApp)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Dashboard Extension] Mensagem do background:', message);
  
  if (message.type === 'WHATSAPP_CONNECTED') {
    isConnected = true;
    window.postMessage({ type: 'WHATSAPP_STATUS_CHANGED', payload: { connected: true } }, '*');
  }
  
  if (message.type === 'WHATSAPP_DISCONNECTED') {
    isConnected = false;
    window.postMessage({ type: 'WHATSAPP_STATUS_CHANGED', payload: { connected: false } }, '*');
  }
  
  sendResponse({ received: true });
  return true;
});

// Notifica a página que a extensão está pronta
setTimeout(() => {
  console.log('[Dashboard Extension] Notificando página que extensão está carregada');
  window.postMessage({ type: 'WHATSAPP_EXTENSION_LOADED' }, '*');
}, 500);
