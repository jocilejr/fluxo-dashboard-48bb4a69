// Content Script — WhatsApp Web (headless bridge)
// No UI, no sidebar. Just command handling.

console.log('[WA Ext] Content script loaded');

const CONFIG = {
  VERSION: '4.0.0',
  API_URL: 'https://suaznqybxvborpkrtdpm.supabase.co/rest/v1',
  API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1YXpucXlieHZib3Jwa3J0ZHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODk5MjgsImV4cCI6MjA4MDI2NTkyOH0.2NXt5eOqM6wCTmlNFpP5H8VxLdVBuarFUwphWbq9kQA'
};

chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============================================
// WSTORE BRIDGE (content → MAIN world)
// ============================================
let wstoreReady = false;
window.addEventListener('WStoreReady', () => {
  wstoreReady = true;
  console.log('[WA Ext] WStore ready');
});

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
    window.dispatchEvent(new CustomEvent('WStoreCall', { detail: { callId, method, args } }));
  });
}

// ============================================
// DOM HELPERS — resilient, no fixed data-tab
// ============================================

// Wait for element using MutationObserver (much more reliable than polling)
function waitForNewElement(parentSelector, matchFn, timeout = 5000) {
  return new Promise((resolve) => {
    const parent = document.querySelector(parentSelector) || document.body;

    // Check if already exists
    const existing = matchFn(parent);
    if (existing) { resolve(existing); return; }

    let resolved = false;
    const observer = new MutationObserver(() => {
      if (resolved) return;
      const el = matchFn(parent);
      if (el) {
        resolved = true;
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(parent, { childList: true, subtree: true });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        observer.disconnect();
        resolve(null);
      }
    }, timeout);
  });
}

// Find element from a list of selectors
function findElement(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch (_) {}
  }
  return null;
}

async function simulateTyping(el, text) {
  el.focus();
  await sleep(100);
  el.textContent = '';
  document.execCommand('insertText', false, text);
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await sleep(200);
}

async function simulateTypingWithBreaks(el, text) {
  el.focus();
  await sleep(100);
  el.textContent = '';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) document.execCommand('insertText', false, lines[i]);
    if (i < lines.length - 1) document.execCommand('insertLineBreak');
  }
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await sleep(200);
}

// ============================================
// FIND SEARCH BUTTON — multiple strategies
// ============================================
function findSearchButton() {
  // Strategy 1: data-testid
  const byTestId = findElement([
    '[data-testid="chat-list-search"]',
    '[data-testid="search"]',
  ]);
  if (byTestId) return byTestId;

  // Strategy 2: known button selectors
  const bySelector = findElement([
    'button[aria-label*="pesquis"]',
    'button[aria-label*="search"]',
    'button[aria-label*="Pesquis"]',
    'button[aria-label*="Search"]',
    'button[aria-label="Nova conversa"]',
    'button[aria-label="New chat"]',
    'span[data-icon="new-chat-outline"]',
  ]);
  if (bySelector) {
    return bySelector.closest('button') || bySelector;
  }

  // Strategy 3: find SVG search icon inside a clickable element
  const searchPaths = document.querySelectorAll('header svg path, [data-testid="chatlist-header"] svg path');
  for (const path of searchPaths) {
    const btn = path.closest('button') || path.closest('[role="button"]') || path.closest('div[tabindex]');
    if (btn) return btn;
  }

  return null;
}

// ============================================
// FIND SEARCH INPUT — MutationObserver based
// ============================================
async function findSearchInput() {
  // Try immediate match first
  const immediate = findElement([
    '[data-testid="chat-list-search"] [contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"][title*="esquis"]',
    'div[contenteditable="true"][role="textbox"][title*="earch"]',
    'div[contenteditable="true"][data-tab="3"]',
    'div[contenteditable="true"][data-tab="2"]',
  ]);
  if (immediate) return immediate;

  // Use MutationObserver to detect any new contenteditable that appears
  return waitForNewElement('body', (parent) => {
    // Find all visible contenteditable textboxes
    const candidates = parent.querySelectorAll('div[contenteditable="true"][role="textbox"]');
    for (const c of candidates) {
      // Skip the message compose box (usually inside footer or has data-tab="10")
      if (c.closest('footer')) continue;
      if (c.dataset.tab === '10' || c.dataset.tab === '6') continue;
      // Must be visible
      if (c.offsetParent !== null) return c;
    }
    // Broader: any contenteditable not in footer
    const broader = parent.querySelectorAll('div[contenteditable="true"]');
    for (const c of broader) {
      if (c.closest('footer')) continue;
      if (c.dataset.tab === '10' || c.dataset.tab === '6') continue;
      if (c.offsetParent !== null && c.closest('[data-testid]')) return c;
    }
    return null;
  }, 4000);
}

// ============================================
// FIND MESSAGE INPUT
// ============================================
function findMessageInput() {
  return findElement([
    '[data-testid="conversation-compose-box-input"]',
    'footer div[contenteditable="true"][role="textbox"]',
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="6"]',
    'div[title="Digite uma mensagem"]',
    'div[title="Type a message"]',
  ]);
}

// ============================================
// OPEN CHAT — 3 layers
// ============================================
async function openChat(phone) {
  console.log('[WA Ext] openChat:', phone, 'wstore:', wstoreReady);

  // === Layer 1: WStore API ===
  if (wstoreReady) {
    const result = await callWStore('openChat', [phone]);
    if (result?.success) {
      console.log('[WA Ext] ✓ Opened via Store:', result.method);
      return { success: true, method: 'store' };
    }
    console.warn('[WA Ext] Store failed:', result?.error);
  }

  // === Layer 2: DOM fallback (resilient) ===
  console.log('[WA Ext] Trying DOM fallback...');
  const domResult = await openChatViaDOM(phone);
  if (domResult.success) return domResult;

  // === Layer 3: SPA navigation fallback ===
  console.log('[WA Ext] Trying SPA navigation...');
  return openChatViaSPA(phone);
}

async function openChatViaDOM(phone) {
  // Step 1: Click search/new-chat button
  const searchBtn = findSearchButton();
  if (!searchBtn) {
    console.warn('[WA Ext] Search button not found');
    return { success: false, error: 'Search button not found' };
  }

  searchBtn.click();
  await sleep(500);

  // Step 2: Find and fill search input
  const searchInput = await findSearchInput();
  if (!searchInput) {
    console.warn('[WA Ext] Search input not found');
    return { success: false, error: 'Search input not found' };
  }

  await simulateTyping(searchInput, phone);
  await sleep(1000);

  // Step 3: Click on the first contact result
  const contact = await waitForNewElement('body', (parent) => {
    // Look for contact list items
    const items = parent.querySelectorAll([
      '[data-testid="cell-frame-container"]',
      '[data-testid="chat-cell-frame-container"]',
      '[role="listitem"]',
      '[data-testid="search-result"]',
    ].join(','));

    for (const item of items) {
      // Check if it contains the phone number (last 4 digits match)
      const text = item.textContent || '';
      const last4 = phone.slice(-4);
      if (text.includes(last4) || items.length === 1) {
        return item;
      }
    }
    // If there are results, click the first one
    if (items.length > 0) return items[0];
    return null;
  }, 3000);

  if (contact) {
    const clickTarget = contact.closest('[role="listitem"]') || contact;
    clickTarget.click();
    await sleep(500);
    console.log('[WA Ext] ✓ Opened via DOM');
    return { success: true, method: 'dom' };
  }

  return { success: false, error: 'Contact not found in search' };
}

function openChatViaSPA(phone) {
  try {
    // Use WhatsApp Web's internal routing
    const url = `/send?phone=${phone}`;
    const currentUrl = window.location.pathname + window.location.search;
    
    // Push state and trigger popstate for SPA routing
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    
    console.log('[WA Ext] ✓ SPA navigation triggered');
    return { success: true, method: 'spa' };
  } catch (e) {
    console.warn('[WA Ext] SPA navigation failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================
// PREPARE TEXT / IMAGE
// ============================================
async function prepareText(phone, text) {
  const openResult = await openChat(phone);
  if (!openResult.success) return openResult;
  await sleep(600);

  // Wait for message input to appear
  const input = await waitForNewElement('body', () => findMessageInput(), 3000);
  if (!input) return { success: false, error: 'Message input not found' };

  await simulateTypingWithBreaks(input, text);
  return { success: true };
}

async function prepareImage(phone, imageDataUrl) {
  const openResult = await openChat(phone);
  if (!openResult.success) return openResult;
  await sleep(600);

  const attachBtn = findElement([
    '[data-testid="attach-menu"]',
    'div[title="Anexar"]',
    'div[title="Attach"]',
    'span[data-icon="plus"]',
    'span[data-icon="attach-menu-plus"]',
  ]);
  if (!attachBtn) return { success: false, error: 'Attach button not found' };

  (attachBtn.closest('button') || attachBtn).click();
  await sleep(300);

  const imgInput = await waitForNewElement('body', (p) => p.querySelector('input[accept*="image"]'), 2000);
  if (!imgInput) return { success: false, error: 'Image input not found' };

  const blob = await fetch(imageDataUrl).then(r => r.blob());
  const file = new File([blob], 'boleto.jpg', { type: 'image/jpeg' });
  const dt = new DataTransfer();
  dt.items.add(file);
  imgInput.files = dt.files;
  imgInput.dispatchEvent(new Event('change', { bubbles: true }));

  return { success: true };
}

// ============================================
// COMMAND LISTENER
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WA Ext] Command:', message.type);

  if (message.type === 'OPEN_CHAT') {
    const phone = message.phone || message.phoneNumber || message.number;
    if (!phone) { sendResponse({ success: false, error: 'No phone' }); return true; }
    openChat(phone).then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'SEND_TEXT') {
    prepareText(message.phone, message.text).then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'SEND_IMAGE') {
    prepareImage(message.phone, message.imageUrl).then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
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
