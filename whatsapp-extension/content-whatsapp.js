// Content Script - WhatsApp Web
// Single-path approach: New Chat button → type number → click result

console.log('[WA Ext] Content script carregado (v7.1 - improved typing)');

chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================
// DOM helpers
// ============================================
function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

// ============================================
// Step 1: Find and click "New Chat" button
// ============================================
function findNewChatButton() {
  const selectors = [
    '[data-testid="chatlist-header-new-chat-button"]',
    'button[aria-label*="Nova conversa"]',
    'button[aria-label*="New chat"]',
    'span[data-icon="new-chat-outline"]',
    'span[data-icon="new-chat"]',
    'button[aria-label*="Novo chat"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) return el.closest('button') || el;
  }
  return null;
}

// ============================================
// Step 2: Find search input (improved targeting)
// ============================================
function findSearchInput() {
  // Priority 1: aria-label match for the search field in "New chat" panel
  const ariaLabels = [
    'div[contenteditable="true"][aria-label*="Pesquisar"]',
    'div[contenteditable="true"][aria-label*="Search"]',
    'div[contenteditable="true"][aria-label*="Buscar"]',
    'input[aria-label*="Pesquisar"]',
    'input[aria-label*="Search"]',
  ];
  for (const sel of ariaLabels) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      // In "New Chat" panel, search is usually on the left side
      if (rect.left > window.innerWidth * 0.65) continue;
      if (rect.top > window.innerHeight * 0.4) continue;
      console.log('[WA Ext] Search input found via aria-label:', el.getAttribute('aria-label'));
      return el;
    }
  }

  // Priority 2: activeElement if it's editable and in the left panel
  const active = document.activeElement;
  if (active && active.getAttribute('contenteditable') === 'true' && isVisible(active)) {
    const rect = active.getBoundingClientRect();
    if (rect.left < window.innerWidth * 0.65 && rect.top < window.innerHeight * 0.4 && !active.closest('footer')) {
      console.log('[WA Ext] Search input found via activeElement');
      return active;
    }
  }

  // Priority 3: generic heuristic (last resort)
  const candidates = document.querySelectorAll(
    'div[contenteditable="true"][role="textbox"], div[contenteditable="true"], input[type="text"]'
  );
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    if (el.closest('footer')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.left > window.innerWidth * 0.65) continue;
    if (rect.top > window.innerHeight * 0.4) continue;
    console.log('[WA Ext] Search input found via generic heuristic');
    return el;
  }
  return null;
}

function waitForElement(finder, timeout = 3000) {
  return new Promise((resolve) => {
    const existing = finder();
    if (existing) { resolve(existing); return; }
    let done = false;
    const observer = new MutationObserver(() => {
      if (done) return;
      const el = finder();
      if (!el) return;
      done = true;
      observer.disconnect();
      resolve(el);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    setTimeout(() => { if (done) return; done = true; observer.disconnect(); resolve(null); }, timeout);
  });
}

// ============================================
// Insert text into search field via multiple methods
// ============================================
async function typeInSearchField(el, text) {
  if (!el) return false;

  console.log('[WA Ext] Attempting to type:', text);
  
  // Focus the element
  el.focus();
  await sleep(100);

  // Method 1: execCommand (often most reliable for contenteditable in React)
  try {
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  } catch (e) {
    console.error('[WA Ext] execCommand failed:', e);
  }

  // Method 2: Manual DOM manipulation + events (fallback/reinforcement)
  if ((el.textContent || '').trim() !== text) {
    // Dispatch beforeinput
    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    }));

    // Clear existing content and insert text node
    while (el.firstChild) el.removeChild(el.firstChild);
    const textNode = document.createTextNode(text);
    el.appendChild(textNode);

    // Place caret at end via Selection+Range
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Dispatch input event to trigger React/WhatsApp internal handlers
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    }));
  }

  // Method 3: Keyboard events (sometimes needed to trigger search)
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

  await sleep(500);

  // Validate insertion
  const content = (el.textContent || '').trim();
  console.log('[WA Ext] Search field content after insert:', JSON.stringify(content));
  return content.includes(text) || content.length > 0;
}

// ============================================
// Insert text into message field (separate function)
// ============================================
async function typeInMessageField(el, text) {
  if (!el) return;
  el.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
}

// ============================================
// Step 3: Find and click first result
// ============================================
function findFirstResult() {
  const selectors = [
    '[data-testid="cell-frame-container"]',
    '[data-testid="chat-cell-frame-container"]',
    '[data-testid="contact-list-item"]',
    '[data-testid*="cell-frame"]',
    '[role="listitem"]',
    '[role="option"]',
  ];

  const searchInput = findSearchInput();
  const searchRect = searchInput?.getBoundingClientRect();
  const searchBottom = searchRect?.bottom || 0;

  const blocked = [
    'novo grupo', 'novo contato', 'nova comunidade',
    'new group', 'new contact', 'new community',
    'pesquisar nome ou número', 'search name or number'
  ];

  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    for (const node of nodes) {
      if (!isVisible(node)) continue;
      const rect = node.getBoundingClientRect();
      
      // Must be below the search input
      if (rect.top < searchBottom - 5) continue;
      
      // Must be in the left panel
      if (rect.left > window.innerWidth * 0.65) continue;
      
      // Reasonable height for a list item
      if (rect.height < 30 || rect.height > 180) continue;
      
      const text = (node.textContent || '').toLowerCase();
      
      // Skip "New Group", etc.
      if (blocked.some((b) => text.includes(b))) continue;
      
      // Skip very short texts that aren't contacts
      if (text.length < 2) continue;
      
      console.log('[WA Ext] Found result candidate:', text.substring(0, 20));
      return node;
    }
  }
  return null;
}

// ============================================
// Confirmation: message input visible = chat opened
// ============================================
function findMessageInput() {
  const selectors = [
    '[data-testid="conversation-compose-box-input"]',
    'footer div[contenteditable="true"][role="textbox"]',
    'footer div[contenteditable="true"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (isVisible(el)) return el;
  }
  return null;
}

// ============================================
// Main: openChat
// ============================================
async function openChat(phoneRaw) {
  const phone = cleanPhone(phoneRaw);
  if (!phone) return { success: false, error: 'invalid_phone' };

  console.log('[WA Ext] openChat:', phone);

  // Step 1: Click "New Chat" button
  const btn = findNewChatButton();
  if (!btn) {
    console.log('[WA Ext] New chat button not found, checking if search is already open');
    const alreadyOpen = findSearchInput();
    if (!alreadyOpen) return { success: false, error: 'new_chat_button_not_found' };
  } else {
    btn.click();
    console.log('[WA Ext] Step 1: New chat button clicked');
  }

  // Step 2: Wait for search input and type number
  const searchInput = await waitForElement(findSearchInput, 4000);
  if (!searchInput) return { success: false, error: 'search_input_not_found' };

  const inserted = await typeInSearchField(searchInput, phone);
  if (!inserted) {
    console.log('[WA Ext] Step 2: FAILED - number not inserted');
    // We continue anyway as sometimes validation fails but it worked
  }
  console.log('[WA Ext] Step 2: Number typed:', phone);

  // Wait for results to load (WhatsApp can be slow)
  await sleep(2000);

  // Step 3: Click first result
  const result = findFirstResult();
  if (!result) {
    console.log('[WA Ext] Step 3: No result found after typing');
    return { success: false, error: 'no_result_found' };
  }

  console.log('[WA Ext] Step 3: Clicking result');
  result.click();
  
  // Try clicking a child if direct click fails
  const inner = result.querySelector('div[role="button"]') || result.querySelector('[data-testid="cell-frame-container"]');
  if (inner) inner.click();

  // Confirm chat opened
  const msgInput = await waitForElement(findMessageInput, 4000);
  if (msgInput) {
    console.log('[WA Ext] ✓ Chat opened successfully');
    return { success: true, method: 'dom' };
  }

  console.log('[WA Ext] Chat did not open after click, retrying click');
  result.click();
  const msgInputRetry = await waitForElement(findMessageInput, 2000);
  if (msgInputRetry) return { success: true, method: 'dom_retry' };

  return { success: false, error: 'chat_did_not_open' };
}

// ============================================
// sendText / sendImage
// ============================================
async function prepareText(phone, text) {
  const opened = await openChat(phone);
  if (!opened.success) return opened;

  const input = await waitForElement(findMessageInput, 3000);
  if (!input) return { success: false, error: 'message_input_not_found' };

  await typeInMessageField(input, text || '');
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

  if (!attach) return { success: false, error: 'attach_button_not_found' };

  (attach.closest('button') || attach).click();
  await sleep(250);

  const input = document.querySelector('input[accept*="image"]');
  if (!input) return { success: false, error: 'image_input_not_found' };

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
  console.log('[WA Ext] Comando recebido:', message.type);

  if (message.type === 'OPEN_CHAT') {
    const phone = message.phone || message.phoneNumber || message.number;
    if (!phone) { 
      console.error('[WA Ext] Telefone ausente na mensagem');
      sendResponse({ success: false, error: 'phone_missing' }); 
      return true; 
    }
    openChat(phone)
      .then((r) => {
        console.log('[WA Ext] Resultado openChat:', r);
        sendResponse(r);
      })
      .catch((e) => {
        console.error('[WA Ext] Erro em openChat:', e);
        sendResponse({ success: false, error: e.message });
      });
    return true;
  }

  if (message.type === 'SEND_TEXT') {
    prepareText(message.phone, message.text)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'SEND_IMAGE') {
    prepareImage(message.phone, message.imageUrl)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ success: false, error: e.message }));
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
