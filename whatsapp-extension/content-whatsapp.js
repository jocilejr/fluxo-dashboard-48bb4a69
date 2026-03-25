// Content Script - WhatsApp Web
// Single-path approach: New Chat button → type number → click result

console.log('[WA Ext] Content script carregado (v7.3 - added delays and improved focus)');

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
// Step 2: Find search input
// ============================================
function findSearchInput() {
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
      if (rect.left > window.innerWidth * 0.65) continue;
      if (rect.top > window.innerHeight * 0.4) continue;
      return el;
    }
  }

  const active = document.activeElement;
  if (active && active.getAttribute('contenteditable') === 'true' && isVisible(active)) {
    const rect = active.getBoundingClientRect();
    if (rect.left < window.innerWidth * 0.65 && rect.top < window.innerHeight * 0.4 && !active.closest('footer')) {
      return active;
    }
  }

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

// ============================================
// Insert text into search field
// ============================================
async function typeInSearchField(el, text) {
  if (!el) return false;

  console.log('[WA Ext] Attempting to type:', text);
  
  // 0.5s delay before focus
  await sleep(500);
  el.focus();
  
  // 0.5s delay after focus to ensure selection
  await sleep(500);

  try {
    // Select all existing text before typing
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  } catch (e) {
    console.error('[WA Ext] execCommand failed:', e);
  }

  if ((el.textContent || '').trim() !== text) {
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
    while (el.firstChild) el.removeChild(el.firstChild);
    const textNode = document.createTextNode(text);
    el.appendChild(textNode);
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
  }

  // 0.5s delay before triggering search
  await sleep(500);
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));

  await sleep(500);
  const content = (el.textContent || '').trim();
  console.log('[WA Ext] Search field content after insert:', JSON.stringify(content));
  return content.includes(text) || content.length > 0;
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
    'div[role="button"]',
  ];

  const searchInput = findSearchInput();
  const searchRect = searchInput?.getBoundingClientRect();
  const searchBottom = searchRect?.bottom || 0;

  const blocked = [
    'novo grupo', 'novo contato', 'nova comunidade',
    'new group', 'new contact', 'new community',
    'pesquisar nome ou número', 'search name or number',
    'não está na sua lista de contatos', 'not in your contacts'
  ];

  const allDivs = document.querySelectorAll('div');
  for (const div of allDivs) {
    if (!isVisible(div)) continue;
    const rect = div.getBoundingClientRect();
    if (rect.top < searchBottom - 5 || rect.left > window.innerWidth * 0.65) continue;
    
    const text = (div.textContent || '').trim();
    if (text.includes('+') && text.replace(/\D/g, '').length >= 8) {
      const clickable = div.closest('[role="button"]') || div.closest('[data-testid="cell-frame-container"]') || div;
      if (clickable && clickable !== document.body) {
        console.log('[WA Ext] Found result via phone number text:', text.substring(0, 20));
        return clickable;
      }
    }
  }

  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    for (const node of nodes) {
      if (!isVisible(node)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.top < searchBottom - 5) continue;
      if (rect.left > window.innerWidth * 0.65) continue;
      if (rect.height < 30 || rect.height > 180) continue;
      
      const text = (node.textContent || '').toLowerCase();
      if (blocked.some((b) => text.includes(b))) continue;
      if (text.length < 2) continue;
      
      console.log('[WA Ext] Found result via selector:', sel, text.substring(0, 20));
      return node;
    }
  }
  return null;
}

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

  const btn = findNewChatButton();
  if (!btn) {
    const alreadyOpen = findSearchInput();
    if (!alreadyOpen) return { success: false, error: 'new_chat_button_not_found' };
  } else {
    btn.click();
    console.log('[WA Ext] Step 1: New chat button clicked');
  }

  // 0.5s delay after clicking New Chat
  await sleep(500);

  const searchInput = await waitForElement(findSearchInput, 4000);
  if (!searchInput) return { success: false, error: 'search_input_not_found' };

  await typeInSearchField(searchInput, phone);
  console.log('[WA Ext] Step 2: Number typed:', phone);

  // 0.5s delay before looking for results
  await sleep(500);
  
  // Wait for results to load (WhatsApp can be slow for non-contacts)
  await sleep(2500);

  const result = findFirstResult();
  if (!result) {
    console.log('[WA Ext] Step 3: No result found, retrying search...');
    searchInput.focus();
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    await sleep(1500);
    const resultRetry = findFirstResult();
    if (!resultRetry) return { success: false, error: 'no_result_found' };
    
    // 0.5s delay before clicking retry result
    await sleep(500);
    resultRetry.click();
  } else {
    console.log('[WA Ext] Step 3: Clicking result');
    
    // 0.5s delay before clicking result
    await sleep(500);
    result.click();
    
    const inner = result.querySelector('div[role="button"]') || result.querySelector('[data-testid="cell-frame-container"]');
    if (inner) {
      await sleep(200);
      inner.click();
    }
  }
  
  const msgInput = await waitForElement(findMessageInput, 5000);
  if (msgInput) {
    console.log('[WA Ext] ✓ Chat opened successfully');
    return { success: true, method: 'dom' };
  }

  return { success: false, error: 'chat_did_not_open' };
}

async function prepareText(phone, text) {
  const opened = await openChat(phone);
  if (!opened.success) return opened;
  
  // 0.5s delay before focusing message input
  await sleep(500);
  
  const input = await waitForElement(findMessageInput, 3000);
  if (!input) return { success: false, error: 'message_input_not_found' };
  
  input.focus();
  await sleep(200);
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, text || '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return { success: true };
}

async function prepareImage(phone, imageDataUrl) {
  const opened = await openChat(phone);
  if (!opened.success) return opened;
  
  await sleep(500);
  const attach = document.querySelector('[data-testid="attach-menu"]') || document.querySelector('div[title="Anexar"]') || document.querySelector('span[data-icon="plus"]');
  if (!attach) return { success: false, error: 'attach_button_not_found' };
  
  (attach.closest('button') || attach).click();
  await sleep(500); // 0.5s delay after clicking attach
  
  const input = document.querySelector('input[accept*="image"]');
  if (!input) return { success: false, error: 'image_input_not_found' };
  const blob = await fetch(imageDataUrl).then((r) => r.blob());
  const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { success: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WA Ext] Comando recebido:', message.type);
  if (message.type === 'OPEN_CHAT') {
    const phone = message.phone || message.phoneNumber || message.number;
    if (!phone) { sendResponse({ success: false, error: 'phone_missing' }); return true; }
    openChat(phone).then((r) => sendResponse(r)).catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (message.type === 'SEND_TEXT') {
    prepareText(message.phone, message.text).then((r) => sendResponse(r)).catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (message.type === 'SEND_IMAGE') {
    prepareImage(message.phone, message.imageUrl).then((r) => sendResponse(r)).catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
  return false;
});

setInterval(() => {
  if (document.visibilityState === 'visible') {
    chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });
  }
}, 5000);
