// Content Script - WhatsApp Web
// Headless bridge only (no UI/sidebar)

console.log('[WA Ext] Content script carregado');

const CONFIG = {
  VERSION: '5.0.0',
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
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function dispatchInput(el, data = '') {
  try {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data }));
  } catch (_) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function dispatchBeforeInput(el, data = '') {
  try {
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data }));
  } catch (_) {}
}

function dispatchKey(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

function getEditableText(el) {
  if (!el) return '';
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return (el.value || '').trim();
  }
  return (el?.innerText || el?.textContent || '').replace(/\u200b/g, '').trim();
}

function hasAnyTerm(text, terms) {
  const value = String(text || '').toLowerCase();
  return terms.some((term) => value.includes(term));
}

function isNewChatPanelOpen() {
  const markers = ['nova conversa', 'new chat', 'novo grupo', 'new group', 'novo contato', 'new contact'];
  const nodes = Array.from(document.querySelectorAll('h1, h2, span, div')).filter(isVisible);
  return nodes.some((node) => {
    const text = (node.textContent || '').trim().toLowerCase();
    if (!text || text.length > 40) return false;
    return markers.some((marker) => text === marker || text.includes(marker));
  });
}

function getVisibleSearchInput(options = {}) {
  const requireNewChat = options.requireNewChat === true;
  const candidates = Array.from(
    document.querySelectorAll(
      [
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        'input[type="text"]',
        'input[role="textbox"]',
        'input[placeholder]',
        'textarea[role="textbox"]',
      ].join(',')
    )
  );

  return candidates.find((el) => {
    if (!isVisible(el)) return false;
    if (el.closest('footer')) return false;

    const rect = el.getBoundingClientRect();
    if (rect.left > window.innerWidth * 0.65) return false;

    const title = (el.getAttribute('title') || '').toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const testid = (el.closest('[data-testid]')?.getAttribute('data-testid') || '').toLowerCase();
    const combined = `${title} ${aria} ${placeholder} ${testid}`;
    const isSearchField = hasAnyTerm(combined, ['pesquis', 'search', 'chat-list-search']);
    const isNewChatSearch = hasAnyTerm(combined, ['nome ou número', 'nome ou numero', 'name or number', 'name or phone']);

    if (requireNewChat) {
      if (isNewChatSearch) return true;
      if (!isNewChatPanelOpen()) return false;
      return rect.top < window.innerHeight * 0.35;
    }

    if (isSearchField) return true;
    return rect.top < window.innerHeight * 0.35;
  }) || null;
}

function findNewChatButton() {
  const direct = document.querySelector(
    [
      'button[aria-label*="Nova conversa"]',
      'button[aria-label*="New chat"]',
      '[data-testid="chatlist-header-new-chat-button"]',
      '[data-testid="new-chat-button"]',
      'span[data-icon="new-chat-outline"]',
      'span[data-icon="new-chat"]',
      'button[aria-label*="Novo chat"]',
    ].join(',')
  );
  if (direct) return direct.closest('button') || direct;

  const icon = document.querySelector('span[data-icon="new-chat-outline"], span[data-icon="new-chat"]');
  if (icon) return icon.closest('button') || icon.closest('[role="button"]') || icon;

  return null;
}

function waitForSearchInput(timeout = 4000, requireNewChat = false) {
  return new Promise((resolve) => {
    const existing = getVisibleSearchInput({ requireNewChat });
    if (existing) { resolve(existing); return; }

    let done = false;
    const observer = new MutationObserver(() => {
      if (done) return;
      const input = getVisibleSearchInput({ requireNewChat });
      if (!input) return;
      done = true;
      observer.disconnect();
      resolve(input);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    setTimeout(() => { if (done) return; done = true; observer.disconnect(); resolve(null); }, timeout);
  });
}

function waitForNewChatPanel(timeout = 3500) {
  return new Promise((resolve) => {
    if (isNewChatPanelOpen()) { resolve(true); return; }
    let done = false;
    const observer = new MutationObserver(() => {
      if (done) return;
      if (!isNewChatPanelOpen()) return;
      done = true;
      observer.disconnect();
      resolve(true);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    setTimeout(() => { if (done) return; done = true; observer.disconnect(); resolve(false); }, timeout);
  });
}

async function ensureSearchInputOpen() {
  const alreadyVisible = getVisibleSearchInput({ requireNewChat: true });
  if (alreadyVisible) return alreadyVisible;

  const btn = findNewChatButton();
  if (!btn) return waitForSearchInput(4500, true);

  btn.click();
  await sleep(250);
  await waitForNewChatPanel(3500);
  return waitForSearchInput(4500, true);
}

async function insertTextInEditable(el, text) {
  const finalText = String(text || '');
  if (!el) return;

  const focusAndClick = () => {
    try { el.focus(); el.click(); } catch (_) {}
  };

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    focusAndClick();
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    dispatchBeforeInput(el, finalText);
    if (setter) setter.call(el, finalText);
    else el.value = finalText;
    dispatchInput(el, finalText);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(180);
    return;
  }

  const clearEditable = () => {
    focusAndClick();
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('delete', false);
    } catch (_) {}
    el.textContent = '';
    dispatchInput(el, '');
  };

  const setCaretToEnd = () => {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch (_) {}
  };

  const typeByExecCommand = async () => {
    try {
      if (document.execCommand('insertText', false, finalText)) {
        dispatchInput(el, finalText);
        return;
      }
    } catch (_) {}

    for (const ch of finalText) {
      try {
        dispatchBeforeInput(el, ch);
        document.execCommand('insertText', false, ch);
      } catch (_) {
        el.textContent = `${getEditableText(el)}${ch}`;
      }
      dispatchInput(el, ch);
      await sleep(8);
    }
  };

  clearEditable();
  await sleep(60);
  focusAndClick();
  setCaretToEnd();
  await typeByExecCommand();

  const typed = getEditableText(el);
  if (finalText && !typed.includes(finalText.slice(0, Math.min(6, finalText.length)))) {
    clearEditable();
    await sleep(60);
    el.textContent = finalText;
    dispatchInput(el, finalText);
    await sleep(40);
    for (const ch of finalText) dispatchKey(el, ch);
  }

  await sleep(160);
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
    if (existing) { resolve(existing); return; }
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
    setTimeout(() => { if (done) return; done = true; observer.disconnect(); resolve(null); }, timeout);
  });
}

function getActiveChatSignature() {
  const selectors = [
    '#main header [data-testid="conversation-info-header-chat-title"]',
    '#main header span[title]',
    '#main header h1',
    '#main header [dir="auto"]',
  ];
  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector)).filter(isVisible);
    for (const node of nodes) {
      const text = (node.textContent || node.getAttribute?.('title') || '').trim();
      if (text && text.length <= 80) return text;
    }
  }
  return '';
}

function isChatSelectionConfirmed(phone, beforeSignature) {
  if (isNewChatPanelOpen()) return false;
  const currentSignature = getActiveChatSignature();
  const digits = currentSignature.replace(/\D/g, '');
  const last4 = phone.slice(-4);
  const hasPhoneMatch = !!(digits && (digits.includes(phone) || digits.includes(last4)));
  const changedChat = !!(currentSignature && currentSignature !== beforeSignature);
  return hasPhoneMatch || changedChat;
}

async function waitForChatSelection(phone, beforeSignature, timeout = 1800) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (isChatSelectionConfirmed(phone, beforeSignature)) return true;
    await sleep(120);
  }
  return isChatSelectionConfirmed(phone, beforeSignature);
}

function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

// ============================================
// React Fiber click — invokes React's internal handler directly
// ============================================
function getReactFiberKey(el) {
  if (!el) return null;
  return Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) || null;
}

function getReactPropsKey(el) {
  if (!el) return null;
  return Object.keys(el).find((k) => k.startsWith('__reactProps$')) || null;
}

function triggerReactClick(el) {
  if (!el) return false;

  // Walk up the tree to find an element with React onClick/onMouseDown handler
  let current = el;
  for (let i = 0; i < 12 && current && current !== document.body; i++) {
    const propsKey = getReactPropsKey(current);
    if (propsKey) {
      const props = current[propsKey];
      if (props) {
        // Try onClick
        if (typeof props.onClick === 'function') {
          console.log('[WA Ext] React onClick found on', current.tagName, current.getAttribute?.('data-testid'));
          const rect = current.getBoundingClientRect();
          const syntheticEvent = {
            type: 'click',
            target: current,
            currentTarget: current,
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            preventDefault: () => {},
            stopPropagation: () => {},
            nativeEvent: new MouseEvent('click'),
          };
          try { props.onClick(syntheticEvent); return true; } catch (e) { console.warn('[WA Ext] React onClick error:', e.message); }
        }
        // Try onMouseDown
        if (typeof props.onMouseDown === 'function') {
          console.log('[WA Ext] React onMouseDown found on', current.tagName);
          const rect = current.getBoundingClientRect();
          try {
            props.onMouseDown({ type: 'mousedown', target: current, currentTarget: current, bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, preventDefault: () => {}, stopPropagation: () => {} });
            return true;
          } catch (e) { console.warn('[WA Ext] React onMouseDown error:', e.message); }
        }
      }
    }
    current = current.parentElement;
  }
  return false;
}

// ============================================
// DOM: click on search result
// ============================================
async function openResultFromList(phone) {
  const beforeSignature = getActiveChatSignature();
  const last4 = phone.slice(-4);
  const blocked = [
    'novo grupo', 'novo contato', 'nova comunidade',
    'new group', 'new contact', 'new community',
    'não está na sua lista de contatos', 'not in your contacts',
  ];

  const searchInput = getVisibleSearchInput({ requireNewChat: true }) || getVisibleSearchInput();
  const searchBottom = searchInput?.getBoundingClientRect()?.bottom || 0;

  // Collect candidate result nodes
  const selectors = [
    '[data-testid="cell-frame-container"]',
    '[data-testid="chat-cell-frame-container"]',
    '[data-testid="contact-list-item"]',
    '[data-testid="search-result"]',
    '[data-testid="chatlist-panel-row"]',
    '[data-testid*="cell-frame"]',
    '[role="listitem"]',
    '[role="button"][data-tab]',
    'div[data-tab][tabindex="0"]',
    '[role="option"]',
    '[role="row"]',
    'div[tabindex="-1"][class]',
  ];

  const leftPane = document.querySelector('#pane-side') || document.querySelector('[data-testid="chatlist-panel"]') || document.body;
  const rawNodes = Array.from(leftPane.querySelectorAll(selectors.join(',')));
  const broadNodes = rawNodes.length > 0
    ? rawNodes
    : Array.from(document.querySelectorAll('div[role="listitem"], div[role="option"], div[role="row"], div[tabindex="-1"]'));

  const allNodes = broadNodes
    .filter((el) => {
      if (!isVisible(el)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.left > window.innerWidth * 0.65) return false;
      if (rect.top < searchBottom - 4) return false;
      if (rect.height < 30 || rect.height > 180) return false;
      return rect.width > 120;
    })
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

  // Find by phone match from leaf nodes
  const byPhoneFromLeaf = Array.from(leftPane.querySelectorAll('span, div[title], [aria-label]'))
    .filter(isVisible)
    .find((node) => {
      const text = ((node.textContent || node.getAttribute?.('title') || node.getAttribute?.('aria-label') || '').toLowerCase()).trim();
      if (!text) return false;
      const digits = text.replace(/\D/g, '');
      return text.includes(phone) || text.includes(last4) || digits.includes(phone) || digits.includes(last4);
    })
    ?.closest('[role="button"][data-tab], div[data-tab][tabindex="0"], [role="listitem"], [role="option"], [role="row"], [data-testid*="cell-frame"]');

  const byPhone = allNodes.find((node) => {
    const text = (node.textContent || '').toLowerCase();
    const digits = text.replace(/\D/g, '');
    if (!text) return false;
    if (blocked.some((b) => text.includes(b))) return false;
    return text.includes(last4) || text.includes(phone) || digits.includes(last4) || digits.includes(phone);
  });

  const firstValid = !byPhone ? allNodes.find((node) => {
    const text = (node.textContent || '').toLowerCase();
    if (!text || text.length < 3) return false;
    return !blocked.some((b) => text.includes(b));
  }) : null;

  const target = byPhone || byPhoneFromLeaf || firstValid || null;
  if (!target) {
    console.log('[WA Ext] openResultFromList: no target found. allNodes:', allNodes.length);
    return false;
  }

  console.log('[WA Ext] Target found:', target.textContent?.slice(0, 60), 'tag:', target.tagName, 'testid:', target.getAttribute?.('data-testid'));

  // Strategy 1: React fiber click (most reliable for React apps)
  target.scrollIntoView?.({ block: 'center', inline: 'nearest' });
  await sleep(100);

  if (triggerReactClick(target)) {
    console.log('[WA Ext] React click dispatched, waiting for chat selection...');
    if (await waitForChatSelection(phone, beforeSignature, 2000)) {
      console.log('[WA Ext] ✓ Chat opened via React click');
      return true;
    }
  }

  // Strategy 2: Native DOM events on the target and its children
  const fireNativeClick = (el) => {
    const rect = el.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    for (const type of ['pointerdown', 'pointerup']) {
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', clientX, clientY }));
    }
    for (const type of ['mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX, clientY }));
    }
    el.click?.();
  };

  // Click on target directly
  fireNativeClick(target);
  if (await waitForChatSelection(phone, beforeSignature, 1200)) return true;

  // Strategy 3: elementFromPoint — hit the exact visual center and walk up
  const rect = target.getBoundingClientRect();
  const points = [
    { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 },
    { x: rect.left + rect.width * 0.3, y: rect.top + rect.height * 0.4 },
    { x: rect.left + rect.width * 0.7, y: rect.top + rect.height * 0.6 },
  ];

  for (const pt of points) {
    const hitEl = document.elementFromPoint(pt.x, pt.y);
    if (!hitEl) continue;

    // Try React click on hit element
    if (triggerReactClick(hitEl)) {
      if (await waitForChatSelection(phone, beforeSignature, 1500)) return true;
    }

    // Try native click on hit element and ancestors
    let candidate = hitEl;
    for (let i = 0; i < 6 && candidate && candidate !== document.body; i++) {
      fireNativeClick(candidate);
      if (await waitForChatSelection(phone, beforeSignature, 600)) return true;
      candidate = candidate.parentElement;
    }
  }

  // Strategy 4: Find any interactive child inside target
  const interactiveChild = target.querySelector('[role="button"], button, [tabindex="0"], a');
  if (interactiveChild && interactiveChild !== target) {
    triggerReactClick(interactiveChild);
    fireNativeClick(interactiveChild);
    if (await waitForChatSelection(phone, beforeSignature, 1200)) return true;
  }

  return waitForChatSelection(phone, beforeSignature, 800);
}

// ============================================
// openChat (3 layers + WStore retry)
// ============================================
async function openChat(phoneRaw) {
  const phone = cleanPhone(phoneRaw);
  if (!phone) return { success: false, error: 'invalid_phone' };

  console.log('[WA Ext] openChat:', phone, 'wstoreReady:', wstoreReady);

  // Layer 1: WStore internal API (try immediately)
  if (wstoreReady) {
    const storeResult = await callWStore('openChat', [phone]);
    if (storeResult?.success) {
      console.log('[WA Ext] ✓ Store opened chat:', storeResult.method);
      return { success: true, method: storeResult.method || 'store' };
    }
    console.warn('[WA Ext] Store falhou:', storeResult?.error);
  }

  // Layer 1b: WStore retry — wait briefly in case it's still bootstrapping
  if (!wstoreReady) {
    console.log('[WA Ext] WStore not ready, waiting 3s for bootstrap...');
    await sleep(3000);
    if (wstoreReady) {
      const storeResult = await callWStore('openChat', [phone]);
      if (storeResult?.success) {
        console.log('[WA Ext] ✓ Store opened chat (retry):', storeResult.method);
        return { success: true, method: storeResult.method || 'store-retry' };
      }
    }
  }

  // Layer 2: DOM flow
  console.log('[WA Ext] Falling back to DOM flow');
  const domResult = await openChatViaDOM(phone);
  if (domResult.success) return domResult;

  // Layer 3: URL navigation (reliable but causes page reload-like behavior)
  return openChatViaURL(phone);
}

async function openChatViaDOM(phone) {
  const input = await ensureSearchInputOpen();
  if (!input) {
    return { success: false, error: 'search_input_not_found' };
  }

  await insertTextInEditable(input, phone);
  const typedText = getEditableText(input);
  if (!typedText.includes(phone.slice(-4))) {
    await insertTextInEditable(input, phone);
  }
  await sleep(1200);

  const clicked = await openResultFromList(phone);
  if (clicked) return { success: true, method: 'dom-click' };

  // Retry with longer wait (results may load slowly)
  await sleep(1500);
  const clicked2 = await openResultFromList(phone);
  if (clicked2) return { success: true, method: 'dom-click-retry' };

  return { success: false, error: 'contact_not_found_after_search' };
}

async function openChatViaURL(phone) {
  try {
    // Use WhatsApp Web's native URL routing
    const targetUrl = `https://web.whatsapp.com/send?phone=${phone}`;
    console.log('[WA Ext] URL fallback:', targetUrl);

    // Method 1: pushState + popstate (SPA-friendly, no reload)
    try {
      const path = `/send?phone=${phone}`;
      history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      await sleep(1500);
      if (findMessageInput()) {
        return { success: true, method: 'url-pushstate' };
      }
    } catch (_) {}

    // Method 2: location.assign (causes reload but reliable)
    window.location.assign(targetUrl);
    return { success: true, method: 'url-redirect' };
  } catch (error) {
    return { success: false, error: `url_fallback_failed: ${error.message}` };
  }
}

async function prepareText(phone, text) {
  const opened = await openChat(phone);
  if (!opened.success) return opened;

  const input = await waitForMessageInput(3500);
  if (!input) return { success: false, error: 'message_input_not_found' };

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
  console.log('[WA Ext] Comando:', message.type, message);

  if (message.type === 'OPEN_CHAT') {
    const phone = message.phone || message.phoneNumber || message.number;
    if (!phone) {
      sendResponse({ success: false, error: 'phone_missing' });
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
