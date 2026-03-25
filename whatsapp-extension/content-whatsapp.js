// Content Script - WhatsApp Web
// Combina manipulação de DOM + Sidebar profissional

console.log('[WhatsApp Extension] Content script carregado');

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG = {
  VERSION: '2.0.0',
  API_URL: 'https://suaznqybxvborpkrtdpm.supabase.co/rest/v1',
  API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1YXpucXlieHZib3Jwa3J0ZHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODk5MjgsImV4cCI6MjA4MDI2NTkyOH0.2NXt5eOqM6wCTmlNFpP5H8VxLdVBuarFUwphWbq9kQA',
  LOGO_URL: 'https://suaznqybxvborpkrtdpm.supabase.co/storage/v1/object/public/assets/logo-ov.png'
};

// ============================================
// ESTADO GLOBAL
// ============================================
let currentPhone = null;
let currentData = null;
let currentTab = 'lead';

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

// Listener para comandos do background
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

// ============================================
// UTILITÁRIOS
// ============================================
function normalizePhone(phone) {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('55') && clean.length > 11) {
    clean = clean.slice(2);
  }
  return clean;
}

function generatePhoneVariations(phone) {
  const clean = normalizePhone(phone);
  if (!clean || clean.length < 10) return [clean];
  
  const variations = new Set();
  variations.add(clean);
  variations.add('55' + clean);
  
  // Com e sem nono dígito
  if (clean.length === 11) {
    const without9 = clean.slice(0, 2) + clean.slice(3);
    variations.add(without9);
    variations.add('55' + without9);
  } else if (clean.length === 10) {
    const with9 = clean.slice(0, 2) + '9' + clean.slice(2);
    variations.add(with9);
    variations.add('55' + with9);
  }
  
  return Array.from(variations);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.ov-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `ov-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado!');
  }).catch(() => {
    showToast('Erro ao copiar', 'error');
  });
}

// ============================================
// EXTRAÇÃO DE TELEFONE
// ============================================
function extractPhoneFromChat() {
  // Método 1: Header do chat
  const header = document.querySelector('header span[title]');
  if (header) {
    const title = header.getAttribute('title');
    const match = title?.match(/[\d\s\-\+\(\)]{10,}/);
    if (match) return normalizePhone(match[0]);
  }
  
  // Método 2: Contato selecionado
  const selected = document.querySelector('div[aria-selected="true"] span[title]');
  if (selected) {
    const title = selected.getAttribute('title');
    const match = title?.match(/[\d\s\-\+\(\)]{10,}/);
    if (match) return normalizePhone(match[0]);
  }
  
  // Método 3: URL
  const urlMatch = window.location.href.match(/phone=([\d]+)/);
  if (urlMatch) return normalizePhone(urlMatch[1]);
  
  return null;
}

// ============================================
// API SUPABASE
// ============================================
async function fetchLeadData(phone) {
  const variations = generatePhoneVariations(phone);
  const orFilter = variations.map(v => `normalized_phone.eq.${v}`).join(',');
  
  try {
    // Buscar transações
    const txRes = await fetch(
      `${CONFIG.API_URL}/transactions?or=(${orFilter})&order=created_at.desc&limit=20`,
      { headers: { 'apikey': CONFIG.API_KEY, 'Authorization': `Bearer ${CONFIG.API_KEY}` } }
    );
    const transactions = await txRes.json();
    
    // Buscar abandonos
    const abRes = await fetch(
      `${CONFIG.API_URL}/abandoned_events?or=(${orFilter})&order=created_at.desc&limit=20`,
      { headers: { 'apikey': CONFIG.API_KEY, 'Authorization': `Bearer ${CONFIG.API_KEY}` } }
    );
    const abandoned = await abRes.json();
    
    // Buscar links úteis
    const linksRes = await fetch(
      `${CONFIG.API_URL}/useful_links?is_active=eq.true&order=sort_order.asc`,
      { headers: { 'apikey': CONFIG.API_KEY, 'Authorization': `Bearer ${CONFIG.API_KEY}` } }
    );
    const links = await linksRes.json();
    
    // Calcular estatísticas
    const paidTx = (transactions || []).filter(t => t.status === 'pago');
    const totalPaid = paidTx.reduce((sum, t) => sum + (t.amount || 0), 0);
    const pendingTx = (transactions || []).filter(t => t.status !== 'pago' && t.status !== 'cancelado');
    const totalPending = pendingTx.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Nome do cliente
    const name = (transactions || [])[0]?.customer_name || 
                 (abandoned || [])[0]?.customer_name || 
                 'Cliente';
    
    return {
      name,
      phone,
      transactions: transactions || [],
      abandoned: abandoned || [],
      links: links || [],
      stats: {
        totalPaid,
        totalPending,
        paidCount: paidTx.length,
        pendingCount: pendingTx.length,
        abandonedCount: (abandoned || []).length
      }
    };
  } catch (error) {
    console.error('[OV] Erro ao buscar dados:', error);
    return null;
  }
}

// ============================================
// RENDERIZAÇÃO DA SIDEBAR
// ============================================
function createSidebar() {
  if (document.getElementById('ov-sidebar')) return;
  
  const sidebar = document.createElement('div');
  sidebar.id = 'ov-sidebar';
  sidebar.innerHTML = `
    <div class="ov-header">
      <img src="${CONFIG.LOGO_URL}" alt="Origem Viva" class="ov-logo" onerror="this.style.display='none'">
    </div>
    <nav class="ov-nav">
      <div class="ov-nav-item active" data-tab="lead">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
        </svg>
        Lead Atual
      </div>
      <div class="ov-nav-item" data-tab="transactions">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        Transações
      </div>
      <div class="ov-nav-item" data-tab="links">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        Links Úteis
      </div>
    </nav>
    <div class="ov-content" id="ov-content">
      <div class="ov-loading"><div class="ov-spinner"></div></div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  // Event listeners para navegação
  sidebar.querySelectorAll('.ov-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      sidebar.querySelectorAll('.ov-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentTab = item.dataset.tab;
      renderContent();
    });
  });
}

function renderContent() {
  const container = document.getElementById('ov-content');
  if (!container) return;
  
  if (!currentData) {
    container.innerHTML = `
      <div class="ov-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <p class="ov-empty-text">Abra uma conversa para ver os dados do lead</p>
      </div>
    `;
    return;
  }
  
  switch (currentTab) {
    case 'lead':
      renderLeadTab(container);
      break;
    case 'transactions':
      renderTransactionsTab(container);
      break;
    case 'links':
      renderLinksTab(container);
      break;
  }
}

function renderLeadTab(container) {
  const { name, phone, stats, transactions, abandoned } = currentData;
  
  container.innerHTML = `
    <div class="ov-lead-card">
      <div class="ov-lead-name">${name}</div>
      <div class="ov-lead-phone">${phone}</div>
      <div class="ov-stats">
        <div class="ov-stat">
          <div class="ov-stat-value">${formatCurrency(stats.totalPaid)}</div>
          <div class="ov-stat-label">Total Pago</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value" style="color: var(--ov-warning)">${formatCurrency(stats.totalPending)}</div>
          <div class="ov-stat-label">Pendente</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value">${stats.paidCount}</div>
          <div class="ov-stat-label">Compras</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value" style="color: var(--ov-danger)">${stats.abandonedCount}</div>
          <div class="ov-stat-label">Abandonos</div>
        </div>
      </div>
    </div>
    
    <div class="ov-section-title">Atividade Recente</div>
    <div class="ov-transaction-list">
      ${transactions.slice(0, 3).map(t => renderTransactionCard(t)).join('')}
      ${abandoned.slice(0, 2).map(a => renderAbandonedCard(a)).join('')}
    </div>
  `;
  
  // Event listeners para recuperação
  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', handleAction);
  });
}

function renderTransactionsTab(container) {
  const { transactions, abandoned } = currentData;
  const all = [
    ...transactions.map(t => ({ ...t, _type: 'transaction' })),
    ...abandoned.map(a => ({ ...a, _type: 'abandoned', created_at: a.created_at }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  if (all.length === 0) {
    container.innerHTML = `
      <div class="ov-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18"/>
        </svg>
        <p class="ov-empty-text">Nenhuma transação encontrada</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="ov-section-title">Todas as Transações</div>
    <div class="ov-transaction-list">
      ${all.map(item => 
        item._type === 'transaction' 
          ? renderTransactionCard(item) 
          : renderAbandonedCard(item)
      ).join('')}
    </div>
  `;
  
  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', handleAction);
  });
}

function renderLinksTab(container) {
  const { links } = currentData;
  
  if (!links || links.length === 0) {
    container.innerHTML = `
      <div class="ov-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <p class="ov-empty-text">Nenhum link configurado</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="ov-section-title">Links Úteis</div>
    ${links.map(link => `
      <div class="ov-link-item" data-url="${link.url}">
        <div class="ov-link-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
        <div class="ov-link-info">
          <div class="ov-link-title">${link.title}</div>
          <div class="ov-link-url">${link.url}</div>
        </div>
      </div>
    `).join('')}
  `;
  
  container.querySelectorAll('.ov-link-item').forEach(el => {
    el.addEventListener('click', () => {
      window.open(el.dataset.url, '_blank');
    });
  });
}

function renderTransactionCard(t) {
  const statusClass = t.status === 'pago' ? 'pago' : 'pendente';
  return `
    <div class="ov-transaction" data-id="${t.id}" data-type="transaction">
      <div class="ov-transaction-header">
        <span class="ov-transaction-type ${t.type}">${t.type.toUpperCase()}</span>
        <span class="ov-transaction-amount">${formatCurrency(t.amount)}</span>
      </div>
      <div class="ov-transaction-status ${statusClass}">${t.status}</div>
      <div class="ov-transaction-date">${formatDate(t.created_at)}</div>
      ${t.status !== 'pago' ? `
        <div class="ov-actions">
          <button class="ov-btn ov-btn-primary" data-action="recover" data-id="${t.id}" data-type="${t.type}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            Recuperar
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAbandonedCard(a) {
  return `
    <div class="ov-transaction" data-id="${a.id}" data-type="abandoned">
      <div class="ov-transaction-header">
        <span class="ov-transaction-type abandoned">ABANDONO</span>
        <span class="ov-transaction-amount">${formatCurrency(a.amount)}</span>
      </div>
      <div class="ov-transaction-status" style="color: var(--ov-danger)">${a.event_type || 'Carrinho abandonado'}</div>
      <div class="ov-transaction-date">${formatDate(a.created_at)}</div>
      <div class="ov-actions">
        <button class="ov-btn ov-btn-primary" data-action="recover-abandoned" data-id="${a.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          Recuperar
        </button>
      </div>
    </div>
  `;
}

// ============================================
// AÇÕES
// ============================================
function handleAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const type = btn.dataset.type;
  
  if (action === 'recover') {
    recoverTransaction(id, type);
  } else if (action === 'recover-abandoned') {
    recoverAbandoned(id);
  }
}

async function recoverTransaction(id, type) {
  const tx = currentData?.transactions?.find(t => t.id === id);
  if (!tx) return;
  
  const firstName = tx.customer_name?.split(' ')[0] || 'Cliente';
  const message = `${getGreeting()}, ${firstName}! 😊\n\nVi aqui que seu ${type} de ${formatCurrency(tx.amount)} está pendente.\n\nPosso te ajudar a finalizar?`;
  
  copyToClipboard(message);
}

async function recoverAbandoned(id) {
  const ab = currentData?.abandoned?.find(a => a.id === id);
  if (!ab) return;
  
  const firstName = ab.customer_name?.split(' ')[0] || 'Cliente';
  const message = `${getGreeting()}, ${firstName}! 😊\n\nVi que você se interessou pelo nosso produto${ab.amount ? ` de ${formatCurrency(ab.amount)}` : ''}.\n\nPosso te ajudar a finalizar sua compra?`;
  
  copyToClipboard(message);
}

// ============================================
// DETECÇÃO DE CONVERSA
// ============================================
async function checkConversation() {
  const phone = extractPhoneFromChat();
  
  if (phone && phone !== currentPhone) {
    currentPhone = phone;
    
    const container = document.getElementById('ov-content');
    if (container) {
      container.innerHTML = '<div class="ov-loading"><div class="ov-spinner"></div></div>';
    }
    
    currentData = await fetchLeadData(phone);
    renderContent();
  } else if (!phone && currentPhone) {
    currentPhone = null;
    currentData = null;
    renderContent();
  }
}

// ============================================
// INICIALIZAÇÃO
// ============================================
function init() {
  console.log('[OV] Iniciando sidebar v' + CONFIG.VERSION);
  
  // Aguarda o WhatsApp carregar
  const waitForApp = setInterval(() => {
    const app = document.getElementById('app');
    if (app) {
      clearInterval(waitForApp);
      createSidebar();
      checkConversation();
      setInterval(checkConversation, 1500);
    }
  }, 500);
}

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
