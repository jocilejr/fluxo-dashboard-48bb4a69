// Content Script - WhatsApp Web
// Single-path approach: New Chat button → type number → click result

console.log('[WA Ext] Content script carregado (v6.0 - simplified)');

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
// Step 2: Wait for search input and type number
// ============================================
function findSearchInput() {
  const candidates = document.querySelectorAll(
    'div[contenteditable="true"][role="textbox"], div[contenteditable="true"], input[type="text"]'
  );
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    if (el.closest('footer')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.left > window.innerWidth * 0.65) continue;
    if (rect.top > window.innerHeight * 0.4) continue;
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

async function typeInEditable(el, text) {
  if (!el) return;

  // Step A: Click to activate the input field (enter typing mode)
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  el.focus();
  await sleep(200);

  // Step B: Clear existing content
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('delete', false);
  } catch (_) {}
  el.textContent = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(100);

  // Step C: Place cursor and type
  el.focus();
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  } catch (_) {}

  if (document.execCommand('insertText', false, text)) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    for (const ch of text) {
      document.execCommand('insertText', false, ch);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(10);
    }
  }

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
  const searchBottom = searchInput?.getBoundingClientRect()?.bottom || 0;

  const blocked = [
    'novo grupo', 'novo contato', 'nova comunidade',
    'new group', 'new contact', 'new community',
  ];

  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    for (const node of nodes) {
      if (!isVisible(node)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.top < searchBottom - 4) continue;
      if (rect.left > window.innerWidth * 0.65) continue;
      if (rect.height < 30 || rect.height > 180) continue;
      const text = (node.textContent || '').toLowerCase();
      if (blocked.some((b) => text.includes(b))) continue;
      if (text.length < 2) continue;
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
  if (!btn) return { success: false, error: 'new_chat_button_not_found' };

  btn.click();
  console.log('[WA Ext] Step 1: New chat button clicked');

  // Step 2: Wait for search input and type number
  const searchInput = await waitForElement(findSearchInput, 3000);
  if (!searchInput) return { success: false, error: 'search_input_not_found' };

  await typeInEditable(searchInput, phone);
  console.log('[WA Ext] Step 2: Number typed:', phone);

  // Wait for results to load
  await sleep(1500);

  // Step 3: Click first result
  const result = findFirstResult();
  if (!result) return { success: false, error: 'no_result_found' };

  result.click();
  console.log('[WA Ext] Step 3: Result clicked');

  // Confirm chat opened
  const msgInput = await waitForElement(findMessageInput, 3000);
  if (msgInput) {
    console.log('[WA Ext] ✓ Chat opened successfully');
    return { success: true, method: 'dom' };
  }

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

  await typeInEditable(input, text || '');
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
  console.log('[WA Ext] Comando:', message.type);

  if (message.type === 'OPEN_CHAT') {
    const phone = message.phone || message.phoneNumber || message.number;
    if (!phone) { sendResponse({ success: false, error: 'phone_missing' }); return true; }
    openChat(phone)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ success: false, error: e.message }));
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
