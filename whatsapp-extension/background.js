// Background Service Worker - Gerencia comunicação entre tabs

let whatsappTabId = null;
let dashboardTabId = null;

// Carrega IDs salvos (para persistência quando Service Worker reinicia)
chrome.storage.local.get(['whatsappTabId', 'dashboardTabId'], (result) => {
  whatsappTabId = result.whatsappTabId || null;
  dashboardTabId = result.dashboardTabId || null;
  console.log('[Background] IDs carregados:', { whatsappTabId, dashboardTabId });
});

// Listener para mensagens do content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Recebeu mensagem:', message.type, 'de tab:', sender.tab?.id);

  // Registra tabs
  if (message.type === 'DASHBOARD_READY') {
    dashboardTabId = sender.tab?.id;
    chrome.storage.local.set({ dashboardTabId });
    console.log('[Background] Dashboard registrado, tab:', dashboardTabId);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'WHATSAPP_READY') {
    whatsappTabId = sender.tab?.id;
    chrome.storage.local.set({ whatsappTabId });
    console.log('[Background] WhatsApp registrado, tab:', whatsappTabId);
    // Notifica dashboard que WhatsApp está pronto
    if (dashboardTabId) {
      chrome.tabs.sendMessage(dashboardTabId, { type: 'WHATSAPP_CONNECTED' }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }

  // Comandos do dashboard para o WhatsApp
  if (['OPEN_CHAT', 'SEND_TEXT', 'SEND_IMAGE'].includes(message.type)) {
    handleWhatsAppCommand(message, sender, sendResponse);
    return true;
  }

  // Ping para verificar conexão
  if (message.type === 'PING') {
    checkWhatsAppConnection().then(connected => {
      sendResponse({ connected, whatsappTabId });
    });
    return true;
  }

  return false;
});

// Verifica se WhatsApp Web está aberto
async function checkWhatsAppConnection() {
  if (!whatsappTabId) return false;
  
  try {
    const tab = await chrome.tabs.get(whatsappTabId);
    return tab && tab.url?.includes('web.whatsapp.com');
  } catch {
    whatsappTabId = null;
    chrome.storage.local.remove('whatsappTabId');
    return false;
  }
}

// Procura ou abre uma tab do WhatsApp Web
async function findOrOpenWhatsApp() {
  // Primeiro verifica se já tem uma tab registrada
  if (whatsappTabId) {
    try {
      const tab = await chrome.tabs.get(whatsappTabId);
      if (tab && tab.url?.includes('web.whatsapp.com')) {
        await chrome.tabs.update(whatsappTabId, { active: true });
        return whatsappTabId;
      }
    } catch {
      whatsappTabId = null;
      chrome.storage.local.remove('whatsappTabId');
    }
  }

  // Procura em todas as tabs
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    whatsappTabId = tabs[0].id;
    chrome.storage.local.set({ whatsappTabId });
    await chrome.tabs.update(whatsappTabId, { active: true });
    return whatsappTabId;
  }

  // Abre nova tab
  const newTab = await chrome.tabs.create({ url: 'https://web.whatsapp.com', active: true });
  whatsappTabId = newTab.id;
  chrome.storage.local.set({ whatsappTabId });
  
  // Aguarda a página carregar
  return new Promise((resolve) => {
    const listener = (tabId, changeInfo) => {
      if (tabId === whatsappTabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => resolve(whatsappTabId), 3000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Encaminha comandos para o WhatsApp
async function handleWhatsAppCommand(message, sender, sendResponse) {
  try {
    const tabId = await findOrOpenWhatsApp();
    
    if (!tabId) {
      sendResponse({ success: false, error: 'Não foi possível abrir WhatsApp Web' });
      return;
    }

    // Aguarda um pouco antes de enviar o comando
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Envia comando para o content script do WhatsApp
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Erro ao enviar para WhatsApp:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('[Background] Resposta do WhatsApp:', response);
        sendResponse(response || { success: false, error: 'Sem resposta do WhatsApp' });
      }
    });
  } catch (error) {
    console.error('[Background] Erro no comando:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Limpa referências quando tabs são fechadas
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === whatsappTabId) {
    whatsappTabId = null;
    chrome.storage.local.remove('whatsappTabId');
    if (dashboardTabId) {
      chrome.tabs.sendMessage(dashboardTabId, { type: 'WHATSAPP_DISCONNECTED' }).catch(() => {});
    }
  }
  if (tabId === dashboardTabId) {
    dashboardTabId = null;
    chrome.storage.local.remove('dashboardTabId');
  }
});

console.log('[Background] Service Worker iniciado');
