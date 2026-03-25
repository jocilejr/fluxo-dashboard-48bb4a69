// Content Script - WhatsApp Web
// Headless bridge only (no UI/sidebar)

console.log('[WA Ext] Content script carregado');

const CONFIG = {
  VERSION: '4.1.0',
  API_URL: 'https://suaznqybxvborpkrtdpm.supabase.co/rest/v1',
  API_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1YXpucXlieHZib3Jwa3J0ZHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODk5MjgsImV4cCI6MjA4MDI2NTkyOH0.2NXt5eOqM6wCTmlNFpP5H8VxLdVBuarFUwphWbq9kQA',
};

chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================
// WStore bridge (MAIN world)
// ============================================
let wstoreReady = false;
window.addEventListener('WStoreReady', (event) => {
  const modules = event.detail?.modules || [];
  const ready = event.detail?.ready === true && modules.length > 0;
  wstoreReady = ready;
  console.log('[WA Ext] WStore status:', { ready, modules });
});

function callWStore(method, args) {
  return new Promise((resolve) => {
    const callId = `wsc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const handler = (event) => {
      if (event.detail?.callId !== callId) return;
      window.removeEventListener('WStoreResponse', handler);
      resolve(event.detail?.result || { success: false, error: 'Sem resultado do WStore' });
    };

    window.addEventListener('WStoreResponse', handler);

    setTimeout(() => {
      window.removeEventListener('WStoreResponse', handler);
      resolve({ success: false, error: 'WStore timeout' });
    }, 10000);

    window.dispatchEvent(
      new CustomEvent('WStoreCall', {
        detail: { callId, method, args },
      })
    );
  });
}

// ============================================
// DOM helpers
// ============================================
function isVisible(el) {
  return !!el && el.offsetParent !== null;
}

function dispatchInput(el, data = '') {
  try {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data }));
  } catch (_) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function dispatchKey(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

function getVisibleSearchInput() {
  const candidates = Array.from(document.querySelectorAll('div[contenteditable="true"][role="textbox"], div[contenteditable="true"]'));

  return candidates.find((el) => {
    if (!isVisible(el)) return false;
    if (el.closest('footer')) return false; // message composer

    const rect = el.getBoundingClientRect();
    if (rect.left > window.innerWidth * 0.65) return false; // search box should be on left pane

    const title = (el.getAttribute('title') || '').toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const testid = (el.closest('[data-testid]')?.getAttribute('data-testid') || '').toLowerCase();

    if (
      title.includes('pesquis') ||
      title.includes('search') ||
      aria.includes('pesquis') ||
      aria.includes('search') ||
      testid.includes('chat-list-search')
    ) {
      return true;
    }

    // fallback for new chat panel: top-left textbox, not footer
    return rect.top < window.innerHeight * 0.35;
  }) || null;
}

function findSearchButton() {
  const direct = document.querySelector(
    '[data-testid="chat-list-search"], button[aria-label*="Nova conversa"], button[aria-label*="New chat"], button[aria-label*="Search"], button[aria-label*="Pesquisar"]'
  );
  if (direct) return direct.closest('button') || direct;

  const icon = document.querySelector('span[data-icon="new-chat-outline"], span[data-icon="search"], span[data-icon="search-refreshed"]');
  if (icon) return icon.closest('button') || icon.closest('[role="button"]') || icon;

  return null;
}

function waitForSearchInput(timeout = 4000) {
  return new Promise((resolve) => {
    const existing = getVisibleSearchInput();
    if (existing) {
      resolve(existing);
      return;
    }

    let done = false;
    const observer = new MutationObserver(() => {
      if (done) return;
      const input = getVisibleSearchInput();
      if (!input) return;
      done = true;
      observer.disconnect();
      resolve(input);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    setTimeout(() => {
      if (done) return;
      done = true;
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

async function ensureSearchInputOpen() {
  const alreadyVisible = getVisibleSearchInput();
  if (alreadyVisible) return alreadyVisible;

  const btn = findSearchButton();
  if (!btn) return null;

  btn.click();
  await sleep(250);
  return waitForSearchInput(4500);
}

async function insertTextInEditable(el, text) {
  el.focus();
  await sleep(60);

  // clear current text
  try {
    document.execCommand('selectAll', false);
    document.execCommand('delete', false);
  } catch (_) {
    el.textContent = '';
  }

  await sleep(60);

  const lines = String(text || '').split('\n');
  let usedExec = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line) {
      try {
        const ok = document.execCommand('insertText', false, line);
        usedExec = usedExec || ok;
      } catch (_) {}
    }

    if (i < lines.length - 1) {
      try {
        document.execCommand('insertLineBreak', false);
      } catch (_) {
        el.appendChild(document.createElement('br'));
      }
    }
  }

  if (!usedExec) {
    el.textContent = text;
  }

  dispatchInput(el, text);
  await sleep(120);
}

function findMessageInput() {
  const candidates = [
    '[data-testid="conversation-compose-box-input"]',
    'footer div[contenteditable="true"][role="textbox"]',
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="6"]',
  ];

  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (isVisible(el)) return el;
  }
  return null;
}

function waitForMessageInput(timeout = 3000) {
  return new Promise((resolve) => {
    const existing = findMessageInput();
    if (existing) {
      resolve(existing);
      return;
    }

    let done = false;
    const observer = new MutationObserver(() => {
      if (done) return;
      const input = findMessageInput();
      if (!input) return;
      done = true;
      observer.disconnect();
      resolve(input);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    setTimeout(() => {
      if (done) return;
      done = true;
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

async function openResultFromList(phone) {
  const last4 = phone.slice(-4);
  const blocked = ['novo grupo', 'novo contato', 'nova comunidade', 'new group', 'new contact', 'new community'];

  const selectors = [
    '[data-testid="cell-frame-container"]',
    '[data-testid="chat-cell-frame-container"]',
    '[role="listitem"]',
    '[data-testid="search-result"]',
  ];

  const nodes = Array.from(document.querySelectorAll(selectors.join(','))).filter(isVisible);

  const byPhone = nodes.find((node) => {
    const text = (node.textContent || '').toLowerCase();
    if (!text) return false;
    if (blocked.some((b) => text.includes(b))) return false;
    return text.includes(last4) || text.includes(phone);
  });

  const target = byPhone || null;
  if (!target) return false;

  (target.closest('[role="listitem"]') || target).click();
  await sleep(500);
  return !!findMessageInput();
}

// ============================================
// openChat (3 layers)
// ============================================
async function openChat(phoneRaw) {
  const phone = cleanPhone(phoneRaw);
  if (!phone) return { success: false, error: 'Telefone inválido' };

  console.log('[WA Ext] openChat:', phone, 'wstoreReady:', wstoreReady);

  // Layer 1: internal Store API
  if (wstoreReady) {
    const storeResult = await callWStore('openChat', [phone]);
    if (storeResult?.success) {
      return { success: true, method: 'store' };
    }
    console.warn('[WA Ext] Store falhou:', storeResult?.error);
  }

  // Layer 2: resilient DOM flow
  const domResult = await openChatViaDOM(phone);
  if (domResult.success) return domResult;

  // Layer 3: SPA route fallback
  return openChatViaSPA(phone);
}

async function openChatViaDOM(phone) {
  const input = await ensureSearchInputOpen();
  if (!input) {
    return { success: false, error: 'Input de busca não encontrado' };
  }

  await insertTextInEditable(input, phone);
  await sleep(600);

  // try enter first (WhatsApp often opens first match)
  dispatchKey(input, 'Enter');
  await sleep(700);

  if (findMessageInput()) {
    return { success: true, method: 'dom-enter' };
  }

  // fallback: click matched result
  const clicked = await openResultFromList(phone);
  if (clicked) {
    return { success: true, method: 'dom-click' };
  }

  return { success: false, error: 'Contato não encontrado após digitação' };
}

function openChatViaSPA(phone) {
  try {
    const targetPath = `/send?phone=${phone}`;
    history.pushState({}, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    return { success: true, method: 'spa' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function prepareText(phone, text) {
  const opened = await openChat(phone);
  if (!opened.success) return opened;

  const input = await waitForMessageInput(3500);
  if (!input) return { success: false, error: 'Campo de mensagem não encontrado' };

  await insertTextInEditable(input, text || '');
  return { success: true };
}

async function prepareImage(phone, imageDataUrl) {
  const opened = await openChat(phone);
  if (!opened.success) return opened;

  await sleep(500);

  const attach =
    document.querySelector('[data-testid="attach-menu"]') ||
    document.querySelector('div[title="Anexar"]') ||
    document.querySelector('div[title="Attach"]') ||
    document.querySelector('span[data-icon="plus"]') ||
    document.querySelector('span[data-icon="attach-menu-plus"]');

  if (!attach) return { success: false, error: 'Botão de anexo não encontrado' };

  (attach.closest('button') || attach).click();
  await sleep(250);

  const input = document.querySelector('input[accept*="image"]');
  if (!input) return { success: false, error: 'Input de imagem não encontrado' };

  const blob = await fetch(imageDataUrl).then((r) => r.blob());
  const file = new File([blob], 'boleto.jpg', { type: 'image/jpeg' });

  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));

  return { success: true };
}

// ============================================
// Background command listener
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WA Ext] Comando:', message.type, message);

  if (message.type === 'OPEN_CHAT') {
    const phone = message.phone || message.phoneNumber || message.number;
    if (!phone) {
      sendResponse({ success: false, error: 'Telefone ausente em OPEN_CHAT' });
      return true;
    }

    openChat(phone)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SEND_TEXT') {
    prepareText(message.phone, message.text)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SEND_IMAGE') {
    prepareImage(message.phone, message.imageUrl)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
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
