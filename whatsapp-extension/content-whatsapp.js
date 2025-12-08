// Content Script - WhatsApp Web
// Origem Viva CRM Dashboard
// VERSION 1.4.1 - MINIMAL DARK THEME

const OV_VERSION = '1.4.2';
console.log('[OV] Content script carregado - VERSION ' + OV_VERSION);

// ========== CONFIG ==========
const API_URL = 'https://suaznqybxvborpkrtdpm.supabase.co/functions/v1/whatsapp-dashboard';
const SIDEBAR_WIDTH = 320;

// ========== STATE ==========
let currentPhone = null;
let sidebarVisible = false;
let currentLeadData = null;

// Register with background
chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' }, () => {
  if (chrome.runtime.lastError) {
    console.error('[OV] Erro ao registrar:', chrome.runtime.lastError);
  }
});

// ========== PHONE UTILS ==========
function generatePhoneVariations(phone) {
  if (!phone) return [];
  
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return [digits];
  
  const variations = new Set();
  let base = digits;
  
  if (base.startsWith('55') && base.length >= 12) {
    base = base.slice(2);
  }
  
  if (base.length === 11 && base[2] === '9') {
    base = base.slice(0, 2) + base.slice(3);
  }
  
  if (base.length === 10) {
    const ddd = base.slice(0, 2);
    const num = base.slice(2);
    const with9 = ddd + '9' + num;
    
    variations.add(base);
    variations.add(with9);
    variations.add('55' + base);
    variations.add('55' + with9);
  } else {
    variations.add(digits);
    if (!digits.startsWith('55')) variations.add('55' + digits);
  }
  
  return Array.from(variations);
}

function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

function formatDisplayPhone(phone) {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith('55')) return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,8)}-${d.slice(8)}`;
  return phone;
}

// ========== CSS - MINIMAL PROFESSIONAL DARK v1.4.0 ==========
function injectStyles() {
  document.querySelectorAll('#ov-styles, style[data-ov]').forEach(s => s.remove());
  
  const style = document.createElement('style');
  style.id = 'ov-styles';
  style.setAttribute('data-ov', 'v1.4.0');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    
    body.ov-open #app {
      width: calc(100% - ${SIDEBAR_WIDTH}px) !important;
      transition: width 0.2s ease;
    }
    
    #ov-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: ${SIDEBAR_WIDTH}px;
      height: 100vh;
      background: #111111;
      border-left: 1px solid #222222;
      z-index: 99999;
      font-family: 'Inter', -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease;
      color: #e5e5e5;
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    
    #ov-panel.hidden { transform: translateX(100%); }
    #ov-panel * { box-sizing: border-box; margin: 0; padding: 0; }
    
    #ov-toggle {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      z-index: 99998;
      background: #111111;
      border: 1px solid #222222;
      border-right: none;
      border-radius: 6px 0 0 6px;
      padding: 10px 6px;
      cursor: pointer;
      transition: all 0.15s;
      color: #888888;
      font-size: 10px;
    }
    
    #ov-toggle:hover { background: #1a1a1a; color: #ffffff; }
    body.ov-open #ov-toggle { right: ${SIDEBAR_WIDTH}px; }
    
    .ov-header {
      padding: 16px 20px;
      background: #111111;
      border-bottom: 1px solid #222222;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    
    .ov-header-left { display: flex; align-items: center; gap: 12px; }
    
    .ov-logo {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      overflow: hidden;
      background: #222222;
    }
    
    .ov-logo img { width: 100%; height: 100%; object-fit: cover; }
    
    .ov-header-text h1 { font-size: 13px; font-weight: 600; color: #ffffff; }
    .ov-header-text span { font-size: 9px; color: #666666; text-transform: uppercase; letter-spacing: 0.1em; }
    
    .ov-close-btn {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: transparent;
      border: none;
      color: #666666;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.15s;
    }
    
    .ov-close-btn:hover { background: #1a1a1a; color: #ffffff; }
    
    .ov-profile {
      padding: 20px;
      background: #111111;
      border-bottom: 1px solid #222222;
      flex-shrink: 0;
    }
    
    .ov-profile-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .ov-avatar {
      width: 40px !important;
      height: 40px !important;
      border-radius: 8px !important;
      background: #1a1a1a !important;
      border: 1px solid #333333 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      color: #888888 !important;
      flex-shrink: 0 !important;
      box-shadow: none !important;
    }
    
    .ov-profile-info { flex: 1; min-width: 0; }
    .ov-profile-name { font-size: 14px; font-weight: 500; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ov-profile-phone { font-size: 11px; color: #666666; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
    
    .ov-copy-icon {
      background: none;
      border: none;
      color: #555555;
      cursor: pointer;
      font-size: 10px;
      padding: 2px;
      transition: color 0.15s;
    }
    
    .ov-copy-icon:hover { color: #ffffff; }
    
    .ov-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    
    .ov-stat-box {
      background: #1a1a1a !important;
      border: 1px solid #222222 !important;
      border-radius: 8px !important;
      padding: 14px !important;
      text-align: center !important;
    }
    
    .ov-stat-box.green, .ov-stat-box.amber, .ov-stat-box.red, .ov-stat-box.slate {
      background: #1a1a1a !important;
      border-color: #222222 !important;
    }
    
    .ov-stat-value {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #ffffff;
    }
    
    .ov-stat-value.green { color: #4ade80; }
    .ov-stat-value.amber { color: #fbbf24; }
    .ov-stat-value.red { color: #f87171; }
    .ov-stat-value.slate { color: #888888; }
    
    .ov-stat-label {
      font-size: 10px;
      color: #666666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .ov-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px 20px;
      background: #111111;
    }
    
    .ov-content::-webkit-scrollbar { width: 4px; }
    .ov-content::-webkit-scrollbar-track { background: transparent; }
    .ov-content::-webkit-scrollbar-thumb { background: #333333; border-radius: 2px; }
    .ov-content::-webkit-scrollbar-thumb:hover { background: #444444; }
    
    .ov-accordion {
      background: #1a1a1a;
      border: 1px solid #222222;
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    
    .ov-accordion-trigger {
      width: 100%;
      padding: 12px 14px;
      background: transparent;
      border: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      color: #e5e5e5;
      transition: background 0.15s;
    }
    
    .ov-accordion-trigger:hover { background: #222222; }
    
    .ov-accordion-trigger-left { display: flex; align-items: center; gap: 8px; }
    .ov-accordion-trigger-left span:first-child { font-size: 12px; }
    .ov-accordion-trigger-left span:last-child { font-size: 12px; font-weight: 500; }
    
    .ov-accordion-badge {
      background: #333333;
      color: #888888;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    
    .ov-accordion-arrow {
      font-size: 10px;
      color: #555555;
      transition: transform 0.2s;
    }
    
    .ov-accordion-trigger.open .ov-accordion-arrow { transform: rotate(180deg); }
    
    .ov-accordion-content {
      display: none;
      padding: 0 14px 14px;
    }
    
    .ov-accordion-content.open { display: block; }
    
    .ov-links-list { display: flex; flex-direction: column; gap: 6px; }
    
    .ov-link-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: #111111;
      border-radius: 6px;
      border: 1px solid #222222;
      transition: all 0.15s;
    }
    
    .ov-link-item:hover { border-color: #333333; }
    
    .ov-link-icon { font-size: 12px; color: #666666; }
    .ov-link-text { flex: 1; min-width: 0; }
    .ov-link-title { font-size: 12px; font-weight: 500; color: #e5e5e5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ov-link-desc { font-size: 10px; color: #555555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
    
    .ov-link-copy {
      font-size: 10px;
      padding: 4px 10px;
      background: #222222;
      border: none;
      border-radius: 4px;
      color: #888888;
      cursor: pointer;
      transition: all 0.15s;
      font-weight: 500;
    }
    
    .ov-link-copy:hover { background: #333333; color: #ffffff; }
    
    .ov-section { margin-bottom: 20px; }
    
    .ov-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 10px;
      margin-bottom: 10px;
      border-bottom: 1px solid #222222;
    }
    
    .ov-section-title {
      font-size: 11px;
      font-weight: 500;
      color: #666666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .ov-section-count {
      font-size: 10px;
      background: #222222;
      color: #888888;
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    .ov-cards { display: flex; flex-direction: column; gap: 8px; }
    
    .ov-card {
      background: #1a1a1a;
      border: 1px solid #222222;
      border-radius: 8px;
      padding: 14px;
      transition: all 0.15s;
      border-left: 2px solid #333333;
    }
    
    .ov-card:hover { border-color: #333333; }
    
    .ov-card.boleto { border-left-color: #fbbf24; }
    .ov-card.pix { border-left-color: #4ade80; }
    .ov-card.cartao { border-left-color: #60a5fa; }
    .ov-card.abandoned { border-left-color: #f87171; }
    
    .ov-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .ov-card-info { flex: 1; min-width: 0; }
    
    .ov-card-name {
      font-size: 12px;
      font-weight: 500;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 6px;
    }
    
    .ov-card-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    
    .ov-tag {
      font-size: 9px;
      padding: 3px 6px;
      border-radius: 4px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      background: #222222;
      color: #888888;
    }
    
    .ov-tag.boleto { color: #fbbf24; }
    .ov-tag.pix { color: #4ade80; }
    .ov-tag.cartao { color: #60a5fa; }
    .ov-tag.gerado, .ov-tag.pendente { color: #fbbf24; }
    .ov-tag.pago { color: #4ade80; }
    .ov-tag.abandoned { color: #f87171; }
    
    .ov-card-date { font-size: 10px; color: #555555; margin-top: 4px; }
    
    .ov-card-amount {
      font-size: 14px;
      font-weight: 600;
      color: #4ade80;
      white-space: nowrap;
    }
    
    .ov-card-amount.pending { color: #fbbf24; }
    .ov-card-amount.danger { color: #f87171; }
    
    .ov-barcode {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #222222;
    }
    
    .ov-barcode-label {
      font-size: 9px;
      color: #555555;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.05em;
    }
    
    .ov-barcode-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .ov-barcode-value {
      flex: 1;
      font-size: 10px;
      font-family: 'SF Mono', Monaco, monospace;
      color: #888888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: #111111;
      padding: 8px 10px;
      border-radius: 4px;
      border: 1px solid #222222;
    }
    
    .ov-barcode-btn {
      font-size: 10px;
      padding: 8px 12px;
      background: #222222;
      border: none;
      border-radius: 4px;
      color: #888888;
      cursor: pointer;
      transition: all 0.15s;
      font-weight: 500;
    }
    
    .ov-barcode-btn:hover { background: #333333; color: #ffffff; }
    
    .ov-action {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #222222;
    }
    
    .ov-action-btn {
      width: 100%;
      padding: 10px 12px;
      background: #222222;
      border: none;
      border-radius: 6px;
      color: #888888;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }
    
    .ov-action-btn:hover { background: #333333; color: #ffffff; }
    
    .ov-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 20px;
      text-align: center;
    }
    
    .ov-empty-icon {
      width: 48px;
      height: 48px;
      background: #1a1a1a;
      border: 1px solid #222222;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      margin-bottom: 14px;
    }
    
    .ov-empty-title { font-size: 14px; font-weight: 500; color: #ffffff; margin-bottom: 4px; }
    .ov-empty-text { font-size: 12px; color: #666666; }
    
    .ov-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 14px;
    }
    
    .ov-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #222222;
      border-top-color: #888888;
      border-radius: 50%;
      animation: ov-spin 0.6s linear infinite;
    }
    
    @keyframes ov-spin { to { transform: rotate(360deg); } }
    
    .ov-loading-text { font-size: 12px; color: #666666; }
    
    .ov-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      border: 1px solid #333333;
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(style);
}

// ========== SIDEBAR ==========
function createSidebar() {
  if (document.getElementById('ov-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'ov-panel';
  panel.className = 'hidden';
  
  const logoUrl = chrome.runtime.getURL('logo-ov.png');
  
  panel.innerHTML = `
    <div class="ov-header">
      <div class="ov-header-left">
        <div class="ov-logo"><img src="${logoUrl}" alt="" /></div>
        <div class="ov-header-text">
          <h1>Origem Viva</h1>
          <span>CRM v${OV_VERSION}</span>
        </div>
      </div>
      <button class="ov-close-btn" onclick="toggleSidebar()">✕</button>
    </div>
    <div class="ov-content" id="ov-main"></div>
  `;
  
  document.body.appendChild(panel);
}

function createToggleButton() {
  if (document.getElementById('ov-toggle')) return;
  
  const btn = document.createElement('button');
  btn.id = 'ov-toggle';
  btn.innerHTML = '◀';
  btn.onclick = toggleSidebar;
  document.body.appendChild(btn);
}

function toggleSidebar() {
  const panel = document.getElementById('ov-panel');
  if (!panel) return;
  
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  document.body.classList.toggle('ov-open', isHidden);
  sidebarVisible = isHidden;
  document.getElementById('ov-toggle').innerHTML = isHidden ? '▶' : '◀';
  
  if (isHidden && currentPhone) loadLeadData(currentPhone);
  else if (isHidden) renderContent();
}

window.toggleSidebar = toggleSidebar;

// ========== RENDER ==========
function renderContent() {
  const container = document.getElementById('ov-main');
  if (!container) return;
  
  if (!currentPhone) {
    container.innerHTML = `
      <div class="ov-empty">
        <div class="ov-empty-icon">💬</div>
        <div class="ov-empty-title">Selecione uma conversa</div>
        <div class="ov-empty-text">Os dados do lead aparecerão aqui</div>
      </div>
    `;
    return;
  }
  
  if (!currentLeadData) {
    container.innerHTML = `
      <div class="ov-loading">
        <div class="ov-spinner"></div>
        <span class="ov-loading-text">Carregando...</span>
      </div>
    `;
    return;
  }
  
  const { customer, transactions = [], abandoned = [], usefulLinks = [] } = currentLeadData;
  const paid = transactions.filter(t => t.status === 'pago');
  const pending = transactions.filter(t => ['gerado', 'pendente'].includes(t.status));
  const totalPaid = paid.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalPending = pending.reduce((s, t) => s + Number(t.amount || 0), 0);
  
  const name = customer?.name || transactions[0]?.customer_name || abandoned[0]?.customer_name || 'Lead';
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  
  let html = `
    <div class="ov-profile">
      <div class="ov-profile-top">
        <div class="ov-avatar">${initials || '?'}</div>
        <div class="ov-profile-info">
          <div class="ov-profile-name">${name}</div>
          <div class="ov-profile-phone">
            ${formatDisplayPhone(currentPhone)}
            <button class="ov-copy-icon" data-copy="${currentPhone}">📋</button>
          </div>
        </div>
      </div>
      <div class="ov-stats">
        <div class="ov-stat-box">
          <div class="ov-stat-value green">${formatCurrency(totalPaid)}</div>
          <div class="ov-stat-label">Total Pago</div>
        </div>
        <div class="ov-stat-box">
          <div class="ov-stat-value amber">${formatCurrency(totalPending)}</div>
          <div class="ov-stat-label">Pendente</div>
        </div>
        <div class="ov-stat-box">
          <div class="ov-stat-value slate">${transactions.length}</div>
          <div class="ov-stat-label">Transações</div>
        </div>
        <div class="ov-stat-box">
          <div class="ov-stat-value red">${abandoned.length}</div>
          <div class="ov-stat-label">Abandonos</div>
        </div>
      </div>
    </div>
  `;
  
  // Links accordion
  if (usefulLinks.length > 0) {
    html += `
      <div class="ov-accordion">
        <button class="ov-accordion-trigger" id="ov-acc-links">
          <div class="ov-accordion-trigger-left">
            <span>🔗</span>
            <span>Links Úteis</span>
            <span class="ov-accordion-badge">${usefulLinks.length}</span>
          </div>
          <span class="ov-accordion-arrow">▼</span>
        </button>
        <div class="ov-accordion-content" id="ov-acc-links-content">
          <div class="ov-links-list">
            ${usefulLinks.map(l => `
              <div class="ov-link-item">
                <span class="ov-link-icon">🌐</span>
                <div class="ov-link-text">
                  <div class="ov-link-title">${l.title}</div>
                  ${l.description ? `<div class="ov-link-desc">${l.description}</div>` : ''}
                </div>
                <button class="ov-link-copy" data-copy="${l.url}">Copiar</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
  
  // Transactions
  if (transactions.length > 0) {
    html += `
      <div class="ov-section">
        <div class="ov-section-header">
          <span class="ov-section-title">📋 Transações</span>
          <span class="ov-section-count">${transactions.length}</span>
        </div>
        <div class="ov-cards">${transactions.map(renderTxCard).join('')}</div>
      </div>
    `;
  }
  
  // Abandoned
  if (abandoned.length > 0) {
    html += `
      <div class="ov-section">
        <div class="ov-section-header">
          <span class="ov-section-title">⚠️ Abandonos</span>
          <span class="ov-section-count">${abandoned.length}</span>
        </div>
        <div class="ov-cards">${abandoned.map(renderAbCard).join('')}</div>
      </div>
    `;
  }
  
  if (transactions.length === 0 && abandoned.length === 0) {
    html += `
      <div class="ov-empty">
        <div class="ov-empty-icon">📭</div>
        <div class="ov-empty-title">Sem histórico</div>
        <div class="ov-empty-text">Nenhum registro encontrado</div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Event listeners
  container.querySelectorAll('[data-copy]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      copyToClipboard(el.dataset.copy);
    });
  });
  
  const accTrigger = document.getElementById('ov-acc-links');
  const accContent = document.getElementById('ov-acc-links-content');
  if (accTrigger && accContent) {
    accTrigger.onclick = () => {
      accTrigger.classList.toggle('open');
      accContent.classList.toggle('open');
    };
  }
}

function renderTxCard(tx) {
  const boletoUrl = tx.metadata?.boleto_url || tx.metadata?.boletoUrl;
  const barcode = tx.external_id;
  const isPending = ['gerado', 'pendente'].includes(tx.status);
  
  let html = `
    <div class="ov-card ${tx.type}">
      <div class="ov-card-top">
        <div class="ov-card-info">
          <div class="ov-card-name">${tx.description || tx.customer_name || 'Transação'}</div>
          <div class="ov-card-tags">
            <span class="ov-tag ${tx.type}">${tx.type}</span>
            <span class="ov-tag ${tx.status}">${tx.status}</span>
            <span class="ov-card-date">${formatDate(tx.created_at)}</span>
          </div>
        </div>
        <div class="ov-card-amount ${isPending ? 'pending' : ''}">${formatCurrency(tx.amount)}</div>
      </div>
  `;
  
  if (barcode && isPending) {
    html += `
      <div class="ov-barcode">
        <div class="ov-barcode-label">Código de Barras</div>
        <div class="ov-barcode-row">
          <div class="ov-barcode-value">${barcode}</div>
          <button class="ov-barcode-btn" data-copy="${barcode}">Copiar</button>
        </div>
      </div>
    `;
  }
  
  if (boletoUrl && isPending) {
    html += `
      <div class="ov-action">
        <button class="ov-action-btn" onclick="window.open('${boletoUrl}', '_blank')">📥 Ver Boleto</button>
      </div>
    `;
  }
  
  return html + '</div>';
}

function renderAbCard(ab) {
  return `
    <div class="ov-card abandoned">
      <div class="ov-card-top">
        <div class="ov-card-info">
          <div class="ov-card-name">${ab.product_name || ab.event_type || 'Abandono'}</div>
          <div class="ov-card-tags">
            <span class="ov-tag abandoned">${ab.event_type || 'abandono'}</span>
            ${ab.funnel_stage ? `<span class="ov-tag" style="background:rgba(100,116,139,0.2);color:#94a3b8;">${ab.funnel_stage}</span>` : ''}
            <span class="ov-card-date">${formatDate(ab.created_at)}</span>
          </div>
        </div>
        ${ab.amount ? `<div class="ov-card-amount danger">${formatCurrency(ab.amount)}</div>` : ''}
      </div>
    </div>
  `;
}

// ========== UTILS ==========
function showToast(msg) {
  document.querySelectorAll('.ov-toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'ov-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast('Copiado!');
}

window.copyToClipboard = copyToClipboard;

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ========== API ==========
async function loadLeadData(phone) {
  console.log('[OV] Carregando lead:', phone);
  
  const variations = generatePhoneVariations(phone);
  console.log('[OV] Variações:', variations);
  
  const container = document.getElementById('ov-main');
  if (container) {
    container.innerHTML = `<div class="ov-loading"><div class="ov-spinner"></div><span class="ov-loading-text">Carregando...</span></div>`;
  }
  
  try {
    const res = await fetch(`${API_URL}?action=lead&phone=${encodeURIComponent(variations.join(','))}`);
    currentLeadData = await res.json();
    console.log('[OV] Dados:', currentLeadData);
    renderContent();
  } catch (err) {
    console.error('[OV] Erro:', err);
    if (container) container.innerHTML = `<div class="ov-empty"><div class="ov-empty-icon">❌</div><div class="ov-empty-title">Erro</div></div>`;
  }
}

// ========== PHONE DETECTION ==========
function extractPhoneFromConversation() {
  const headerSpans = document.querySelectorAll('header span[title], header span[dir="auto"]');
  for (const span of headerSpans) {
    const text = span.getAttribute('title') || span.textContent || '';
    const phone = extractPhoneFromText(text);
    if (phone) return phone;
  }
  
  const title = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
  if (title) {
    const phone = extractPhoneFromText(title.textContent || '');
    if (phone) return phone;
  }
  
  const jidEls = document.querySelectorAll('[data-jid]');
  for (const el of jidEls) {
    const jid = el.getAttribute('data-jid');
    if (jid?.includes('@')) {
      const phone = jid.split('@')[0];
      if (/^\d{10,15}$/.test(phone)) return phone;
    }
  }
  
  return null;
}

function extractPhoneFromText(text) {
  if (!text) return null;
  const cleaned = text.replace(/[\s\-\(\)\.]/g, '');
  const patterns = [/\+?55\d{10,11}/, /\d{12,13}/, /\+\d{10,15}/];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m) return m[0].replace(/^\+/, '');
  }
  return null;
}

function observeConversationChanges() {
  let lastPhone = null;
  
  const check = () => {
    const phone = extractPhoneFromConversation();
    if (phone && phone !== lastPhone) {
      console.log('[OV] Conversa:', phone);
      lastPhone = phone;
      currentPhone = phone;
      if (sidebarVisible) loadLeadData(phone);
    }
  };
  
  setInterval(check, 1000);
  
  const observer = new MutationObserver(() => setTimeout(check, 200));
  const waitForApp = setInterval(() => {
    const app = document.querySelector('#app');
    if (app) {
      clearInterval(waitForApp);
      observer.observe(document.body, { childList: true, subtree: true });
      check();
    }
  }, 500);
}

// ========== CLICK SIMULATION ==========
function simulatedClick(target, opts = {}) {
  if (!target?.ownerDocument) return;
  
  const event = target.ownerDocument.createEvent('MouseEvents');
  const cfg = {
    type: 'click', canBubble: true, cancelable: true,
    view: target.ownerDocument.defaultView, detail: 1,
    screenX: 0, screenY: 0, clientX: 0, clientY: 0,
    ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    button: 0, relatedTarget: null, ...opts
  };
  
  event.initMouseEvent(cfg.type, cfg.canBubble, cfg.cancelable, cfg.view, cfg.detail,
    cfg.screenX, cfg.screenY, cfg.clientX, cfg.clientY,
    cfg.ctrlKey, cfg.altKey, cfg.shiftKey, cfg.metaKey, cfg.button, cfg.relatedTarget);
  
  target.dispatchEvent(event);
}

function simClick(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const coords = { clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
  simulatedClick(el, { type: 'mousedown', ...coords });
  simulatedClick(el, { type: 'mouseup', ...coords });
  simulatedClick(el, { type: 'click', ...coords });
}

// ========== OPEN CHAT ==========
async function openChat(phone) {
  const formatted = formatPhoneForWhatsApp(phone);
  console.log('[OV] Abrindo chat:', formatted);
  
  try {
    // Find new chat button immediately
    const newChatSelectors = ['span[data-icon="new-chat"]', 'span[data-icon="new-chat-outline"]', '[data-testid="menu-bar-new-chat"]'];
    let newChatBtn = null;
    for (const sel of newChatSelectors) {
      const el = document.querySelector(sel);
      if (el) { newChatBtn = el.closest('[role="button"]') || el.parentElement || el; break; }
    }
    
    if (!newChatBtn) { console.error('[OV] Botão nova conversa não encontrado'); return false; }
    
    simClick(newChatBtn);
    
    // Wait for search panel to appear
    await new Promise(r => setTimeout(r, 400));
    
    // Find search input with multiple attempts
    let searchInput = null;
    const searchSelectors = [
      'div[contenteditable="true"][data-tab="3"]', 
      'p.selectable-text[data-tab="3"]',
      '[data-testid="chat-list-search"]',
      'div[role="textbox"][contenteditable="true"]'
    ];
    
    for (let i = 0; i < 20; i++) {
      for (const sel of searchSelectors) {
        searchInput = document.querySelector(sel);
        if (searchInput) break;
      }
      if (!searchInput) {
        // Try within side panel
        const sidePanel = document.querySelector('[data-testid="side"]') || document.querySelector('#pane-side');
        if (sidePanel) {
          searchInput = sidePanel.querySelector('div[contenteditable="true"]') || 
                       sidePanel.querySelector('p.selectable-text');
        }
      }
      if (searchInput) break;
      await new Promise(r => setTimeout(r, 100));
    }
    
    if (!searchInput) { 
      console.error('[OV] Campo busca não encontrado após tentativas'); 
      return false; 
    }
    
    console.log('[OV] Campo busca encontrado, digitando:', formatted);
    
    // Type immediately
    searchInput.focus();
    searchInput.textContent = '';
    document.execCommand('insertText', false, formatted);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
    
    // Poll for contact with shorter intervals
    const lastDigits = formatted.slice(-8);
    let contactItem = null;
    
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(r => setTimeout(r, 100));
      
      const searchPanel = document.querySelector('#pane-side');
      if (!searchPanel) continue;
      
      for (const cell of searchPanel.querySelectorAll('[data-testid="cell-frame-container"], div[tabindex="-1"]')) {
        if ((cell.textContent || '').replace(/\D/g, '').includes(lastDigits)) {
          contactItem = cell;
          break;
        }
      }
      
      if (!contactItem) {
        contactItem = searchPanel.querySelector('[data-testid="cell-frame-container"]');
      }
      
      if (contactItem) break;
    }
    
    if (contactItem) {
      simClick(contactItem);
      
      // Quick check for opened chat
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 50));
        if (document.querySelector('[data-testid="conversation-compose-box-input"]')) {
          console.log('[OV] Chat aberto!');
          return true;
        }
      }
      
      // Retry with child element
      const child = contactItem.querySelector('span') || contactItem.firstElementChild;
      if (child) simClick(child);
      
      return true;
    }
    
    console.error('[OV] Contato não encontrado');
    return false;
  } catch (err) {
    console.error('[OV] Erro:', err);
    return false;
  }
}

async function sendTextMessage(text) {
  try {
    const input = document.querySelector('[data-testid="conversation-compose-box-input"], footer [contenteditable="true"]');
    if (!input) return false;
    
    input.focus();
    input.textContent = '';
    for (const line of text.split('\n')) {
      document.execCommand('insertText', false, line);
      document.execCommand('insertLineBreak');
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return true;
  } catch (err) {
    console.error('[OV] Erro ao enviar:', err);
    return false;
  }
}

// ========== MESSAGE LISTENER ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[OV] Mensagem:', request);
  
  if (request.type === 'PING') {
    sendResponse({ status: 'ok', location: window.location.href });
    return true;
  }
  
  if (request.type === 'OPEN_CHAT') {
    openChat(request.phone).then(success => sendResponse({ success }));
    return true;
  }
  
  if (request.type === 'SEND_TEXT') {
    sendTextMessage(request.text).then(success => sendResponse({ success }));
    return true;
  }
  
  sendResponse({ success: false });
  return true;
});

// ========== INIT ==========
function init() {
  console.log('[OV] Inicializando...');
  injectStyles();
  createSidebar();
  createToggleButton();
  observeConversationChanges();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
