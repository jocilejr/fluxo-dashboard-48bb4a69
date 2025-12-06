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

// Aguarda elemento aparecer no DOM
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout esperando elemento: ${selector}`));
        return;
      }
      
      requestAnimationFrame(check);
    };
    
    check();
  });
}

// Simula digitação no input
function typeText(element, text) {
  element.focus();
  
  // Usa execCommand para inserir texto
  document.execCommand('insertText', false, text);
  
  // Dispara eventos
  element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
}

// Formata número de telefone para WhatsApp
function formatPhone(phone) {
  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, '');
  
  // Se não começar com código do país, adiciona 55 (Brasil)
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

// Abre uma conversa com o número especificado
async function openChat(phone) {
  const formattedPhone = formatPhone(phone);
  console.log('[WhatsApp Extension] Abrindo chat com:', formattedPhone);

  try {
    // Clica no botão "Nova conversa"
    const newChatButton = await waitForElement('[data-tab="2"], [aria-label="Nova conversa"], [aria-label="New chat"]', 5000);
    newChatButton.click();
    
    await new Promise(resolve => setTimeout(resolve, 500));

    // Encontra o campo de busca
    const searchInput = await waitForElement('[data-tab="3"], [aria-label="Pesquisar ou começar uma nova conversa"], [aria-label="Search input textbox"]', 5000);
    
    // Limpa e digita o número
    searchInput.focus();
    searchInput.textContent = '';
    
    // Usa clipboard para colar o número (mais confiável)
    await navigator.clipboard.writeText(formattedPhone);
    document.execCommand('paste');
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Clica no resultado (primeiro contato ou "Conversar com +55...")
    const resultSelectors = [
      '[data-testid="cell-frame-container"]',
      '._ajvq',
      '[data-testid="chat-list"] [role="listitem"]',
      'span[title*="' + formattedPhone.slice(-8) + '"]'
    ];

    for (const selector of resultSelectors) {
      try {
        const result = await waitForElement(selector, 2000);
        if (result) {
          result.click();
          console.log('[WhatsApp Extension] Chat aberto com sucesso');
          return;
        }
      } catch {
        continue;
      }
    }

    // Fallback: tenta pressionar Enter para abrir o chat
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('[WhatsApp Extension] Chat aberto (fallback)');
    
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao abrir chat:', error);
    throw error;
  }
}

// Envia mensagem de texto
async function sendText(phone, text) {
  console.log('[WhatsApp Extension] Enviando texto para:', phone);

  // Primeiro abre o chat
  await openChat(phone);
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Encontra o campo de mensagem
    const messageInput = await waitForElement(
      '[data-tab="10"], [data-testid="conversation-compose-box-input"], [contenteditable="true"][data-tab="10"]',
      5000
    );

    // Cola a mensagem preservando quebras de linha
    messageInput.focus();
    
    // Divide o texto por quebras de linha e insere cada parte
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      // Insere a linha
      if (lines[i]) {
        await navigator.clipboard.writeText(lines[i]);
        document.execCommand('paste');
      }
      
      // Se não for a última linha, adiciona quebra de linha (Shift+Enter)
      if (i < lines.length - 1) {
        messageInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          shiftKey: true,
          bubbles: true
        }));
        // Também insere uma quebra de linha no contenteditable
        document.execCommand('insertLineBreak');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));

    // Nota: Não envia automaticamente - deixa o usuário revisar e enviar
    console.log('[WhatsApp Extension] Mensagem preparada (aguardando envio manual)');
    
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao preparar mensagem:', error);
    throw error;
  }
}

// Prepara para enviar imagem
async function sendImage(phone, imageUrl) {
  console.log('[WhatsApp Extension] Preparando imagem para:', phone);

  // Primeiro abre o chat
  await openChat(phone);
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Nota: Não é possível enviar imagem automaticamente por restrições de segurança
  // O usuário precisará fazer drag-and-drop manualmente
  console.log('[WhatsApp Extension] Chat aberto - arraste a imagem para enviar');
}

// Verifica periodicamente se ainda está na página do WhatsApp
setInterval(() => {
  if (document.visibilityState === 'visible') {
    chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });
  }
}, 5000);
