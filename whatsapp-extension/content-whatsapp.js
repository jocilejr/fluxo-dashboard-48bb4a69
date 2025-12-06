// Content Script - WhatsApp Web
// Executa ações na interface do WhatsApp

console.log('[WhatsApp Extension] Content script carregado');

// Registra no background
chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('[WhatsApp Extension] Erro ao registrar:', chrome.runtime.lastError);
  } else {
    console.log('[WhatsApp Extension] Registrado no background');
  }
});

// Escuta comandos do background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WhatsApp Extension] Recebeu comando:', message.type);

  if (message.type === 'OPEN_CHAT') {
    openChat(message.phone)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SEND_TEXT') {
    sendText(message.phone, message.text)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SEND_IMAGE') {
    sendImage(message.phone, message.imageUrl)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});

// Aguarda elemento aparecer no DOM (timeout reduzido)
function waitForElement(selector, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout: ${selector}`));
        return;
      }
      
      requestAnimationFrame(check);
    };
    
    check();
  });
}

// Formata número de telefone para WhatsApp
function formatPhone(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

// Insere texto no elemento contenteditable com quebras de linha
function insertTextWithLineBreaks(element, text) {
  element.focus();
  element.innerHTML = '';
  
  // Substitui \n por <br> para contenteditable
  const htmlContent = text
    .split('\n')
    .map(line => line || '<br>')
    .join('<br>');
  
  element.innerHTML = htmlContent;
  
  // Dispara eventos para o WhatsApp detectar a mudança
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Abre uma conversa com o número especificado
async function openChat(phone) {
  const formattedPhone = formatPhone(phone);
  console.log('[WhatsApp] Abrindo chat:', formattedPhone);

  try {
    // Clica no botão "Nova conversa"
    const newChatBtn = document.querySelector('[data-tab="2"]') 
      || document.querySelector('[aria-label="Nova conversa"]')
      || document.querySelector('[aria-label="New chat"]')
      || document.querySelector('span[data-icon="new-chat-outline"]')?.parentElement;
    
    if (!newChatBtn) throw new Error('Botão nova conversa não encontrado');
    newChatBtn.click();
    
    await new Promise(r => setTimeout(r, 300));

    // Encontra o campo de busca
    const searchInput = await waitForElement('[data-tab="3"]', 1000);
    searchInput.focus();
    searchInput.textContent = formattedPhone;
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
    
    await new Promise(r => setTimeout(r, 500));

    // Clica no primeiro resultado
    const result = document.querySelector('[data-testid="cell-frame-container"]')
      || document.querySelector('._ajvq')
      || document.querySelector('[data-testid="chat-list"] [role="listitem"]');
    
    if (result) {
      result.click();
    } else {
      // Fallback: Enter para abrir
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    }
    
    await new Promise(r => setTimeout(r, 300));
    console.log('[WhatsApp] Chat aberto');
    
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    throw error;
  }
}

// Envia mensagem de texto
async function sendText(phone, text) {
  console.log('[WhatsApp] Enviando texto para:', phone);

  await openChat(phone);
  await new Promise(r => setTimeout(r, 400));

  try {
    // Encontra o campo de mensagem
    const messageInput = document.querySelector('[data-tab="10"]')
      || document.querySelector('[data-testid="conversation-compose-box-input"]')
      || document.querySelector('footer div[contenteditable="true"]');

    if (!messageInput) throw new Error('Campo de mensagem não encontrado');

    // Insere texto com quebras de linha
    insertTextWithLineBreaks(messageInput, text);
    
    await new Promise(r => setTimeout(r, 200));
    console.log('[WhatsApp] Mensagem preparada');
    
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    throw error;
  }
}

// Prepara para enviar imagem
async function sendImage(phone, imageUrl) {
  console.log('[WhatsApp] Preparando imagem para:', phone);
  await openChat(phone);
  console.log('[WhatsApp] Chat aberto - arraste a imagem para enviar');
}

// Verifica periodicamente se ainda está na página
setInterval(() => {
  if (document.visibilityState === 'visible') {
    chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });
  }
}, 5000);
