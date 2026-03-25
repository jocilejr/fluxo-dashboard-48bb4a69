// Content Script - WhatsApp Web
// Ponte invisível de comandos (sem UI/sidebar)

console.log('[WhatsApp Extension] Content script carregado');

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG = {
  VERSION: '3.1.0',
  API_URL: 'https://suaznqybxvborpkrtdpm.supabase.co/rest/v1',
  API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1YXpucXlieHZib3Jwa3J0ZHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODk5MjgsImV4cCI6MjA4MDI2NTkyOH0.2NXt5eOqM6wCTmlNFpP5H8VxLdVBuarFUwphWbq9kQA'
};

// ============================================
// FUNÇÕES VIA STORE API (sem seletores CSS)
// ============================================
chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Track WStore readiness from inject-store.js (runs in MAIN world)
let wstoreReady = false;

window.addEventListener('WStoreReady', () => {
  wstoreReady = true;
  console.log('[WhatsApp Extension] WStore ready!');
});

// Bridge: content script calls MAIN world's WStore via CustomEvents
function callWStore(method, args) {
  return new Promise((resolve) => {
    const callId = 'wsc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    const handler = (e) => {
      if (e.detail?.callId === callId) {
        window.removeEventListener('WStoreResponse', handler);
        resolve(e.detail.result);
      }
    };
    window.addEventListener('WStoreResponse', handler);
    setTimeout(() => {
      window.removeEventListener('WStoreResponse', handler);
      resolve({ success: false, error: 'WStore call timeout' });
    }, 10000);
    
    window.dispatchEvent(new CustomEvent('WStoreCall', {
      detail: { callId, method, args }
    }));
  });
}

// DOM fallback helpers
async function waitForElement(selectors, timeout = 5000) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el?.offsetParent !== null) return el;
    }
    await sleep(75);
  }
  return null;
}

async function simulateTyping(el, text) {
  el.focus();
  await sleep(50);
  el.textContent = "";
  document.execCommand("insertText", false, text);
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await sleep(150);
}

async function simulateTypingWithBreaks(el, text) {
  el.focus();
  await sleep(50);
  el.textContent = "";
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      document.execCommand("insertText", false, lines[i]);
    }
    if (i < lines.length - 1) {
      document.execCommand("insertLineBreak");
    }
  }
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await sleep(150);
}

// ============================================
// OPEN CHAT — Store API first, DOM fallback
// ============================================
async function openChat(phone) {
  console.log('[WhatsApp Extension] openChat:', phone, 'wstoreReady:', wstoreReady);

  // Method 1: WStore API (no CSS selectors)
  if (wstoreReady) {
    const result = await callWStore('openChat', [phone]);
    if (result?.success) {
      console.log('[WhatsApp Extension] Chat opened via Store:', result.method);
      return { success: true };
    }
    console.warn('[WhatsApp Extension] Store failed:', result?.error, '→ DOM fallback');
  }

  // Method 2: DOM fallback
  const newChatBtn = document.querySelector('button[data-tab="2"]') || 
                     document.querySelector('button[aria-label="Nova conversa"]') ||
                     document.querySelector('[data-testid="chat-list-search"]') ||
                     document.querySelector('span[data-icon="new-chat-outline"]')?.closest('button');
  
  if (newChatBtn) {
    newChatBtn.click();
    await sleep(400);
  } else {
    return { success: false, error: "New chat button not found" };
  }
  
  const searchInput = await waitForElement([
    'div[contenteditable="true"][data-tab="3"]',
    'div[title="Pesquisar nome ou número"]',
    'div[role="textbox"][data-tab="3"]'
  ], 3000);
  
  if (!searchInput) return { success: false, error: "Search not found" };
  
  await simulateTyping(searchInput, phone);
  await sleep(750);
  
  const contact = await waitForElement([
    `span[title*="${phone.slice(-4)}"]`,
    'div[data-testid="cell-frame-container"]',
    'div[role="listitem"]'
  ], 2000);
  
  if (contact) {
    (contact.closest('div[role="listitem"]') || contact).click();
    await sleep(500);
    return { success: true };
  }
  
  return { success: false, error: "Contact not found" };
}

async function prepareText(phone, text) {
  const openResult = await openChat(phone);
  if (!openResult.success) return openResult;
  
  await sleep(500);
  
  const input = await waitForElement([
    'div[contenteditable="true"][data-tab="10"]',
    'footer div[contenteditable="true"]',
    'div[title="Digite uma mensagem"]',
    'div[role="textbox"][data-tab="10"]'
  ], 2500);
  
  if (!input) return { success: false, error: "Input not found" };
  
  await simulateTypingWithBreaks(input, text);
  return { success: true };
}

async function prepareImage(phone, imageDataUrl) {
  const openResult = await openChat(phone);
  if (!openResult.success) return openResult;
  
  await sleep(500);
  
  const attachBtn = await waitForElement([
    'div[title="Anexar"]', 
    'span[data-icon="plus"]',
    'span[data-icon="attach-menu-plus"]'
  ], 2000);
  if (!attachBtn) return { success: false, error: "Attach not found" };
  
  attachBtn.click();
  await sleep(250);
  
  const imgInput = await waitForElement(['input[accept*="image"]'], 1500);
  if (!imgInput) return { success: false, error: "Image input not found" };
  
  const blob = await fetch(imageDataUrl).then(r => r.blob());
  const file = new File([blob], "boleto.jpg", { type: "image/jpeg" });
  const dt = new DataTransfer();
  dt.items.add(file);
  imgInput.files = dt.files;
  imgInput.dispatchEvent(new Event("change", { bubbles: true }));
  
  return { success: true };
}

// ============================================
// LISTENER DE COMANDOS
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WhatsApp Extension] Recebeu comando:', message.type);

  if (message.type === 'OPEN_CHAT') {
    const phone = message.phone || message.phoneNumber || message.number;
    if (!phone) {
      sendResponse({ success: false, error: 'Phone number missing in OPEN_CHAT' });
      return true;
    }
    openChat(phone)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SEND_TEXT') {
    prepareText(message.phone, message.text)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SEND_IMAGE') {
    prepareImage(message.phone, message.imageUrl)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});

// Keep-alive
setInterval(() => {
  if (document.visibilityState === 'visible') {
    chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });
  }
}, 5000);
