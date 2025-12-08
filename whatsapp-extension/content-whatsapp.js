// Content Script - WhatsApp Web
// Origem Viva CRM Dashboard

console.log('[OV] Content script carregado');

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

// ========== CSS - CLEAN PROFESSIONAL DARK THEME ==========
function injectStyles() {
  if (document.getElementById('ov-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'ov-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
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
      background: #0f172a;
      border-left: 1px solid #1e293b;
      z-index: 99999;
      font-family: 'Inter', -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease;
      box-shadow: -4px 0 20px rgba(0,0,0,0.3);
      color: #e2e8f0;
      font-size: 13px;
      line-height: 1.5;
    }
    
    #ov-panel.hidden { transform: translateX(100%); }
    #ov-panel * { box-sizing: border-box; margin: 0; padding: 0; }
    
    /* Toggle Button */
    #ov-toggle {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      z-index: 99998;
      background: #1e293b;
      border: 1px solid #334155;
      border-right: none;
      border-radius: 6px 0 0 6px;
      padding: 10px 6px;
      cursor: pointer;
      transition: all 0.15s;
      color: #94a3b8;
      font-size: 10px;
    }
    
    #ov-toggle:hover { background: #334155; }
    body.ov-open #ov-toggle { right: ${SIDEBAR_WIDTH}px; }
    
    /* Header */
    .ov-header {
      padding: 12px 14px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    
    .ov-header-left { display: flex; align-items: center; gap: 10px; }
    
    .ov-logo {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      overflow: hidden;
      background: #334155;
    }
    
    .ov-logo img { width: 100%; height: 100%; object-fit: cover; }
    
    .ov-header-text h1 { font-size: 13px; font-weight: 600; color: #f1f5f9; }
    .ov-header-text span { font-size: 10px; color: #64748b; }
    
    .ov-close-btn {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: #334155;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.15s;
    }
    
    .ov-close-btn:hover { background: #ef4444; color: #fff; }
    
    /* Profile Section */
    .ov-profile {
      padding: 14px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      flex-shrink: 0;
    }
    
    .ov-profile-top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .ov-avatar {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      flex-shrink: 0;
    }
    
    .ov-profile-info { flex: 1; min-width: 0; }
    .ov-profile-name { font-size: 14px; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ov-profile-phone { font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 6px; }
    
    .ov-copy-icon {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 10px;
      padding: 2px;
      transition: color 0.15s;
    }
    
    .ov-copy-icon:hover { color: #22c55e; }
    
    /* Stats Grid */
    .ov-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    
    .ov-stat-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    
    .ov-stat-value {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    
    .ov-stat-value.green { color: #22c55e; }
    .ov-stat-value.amber { color: #f59e0b; }
    .ov-stat-value.red { color: #ef4444; }
    .ov-stat-value.slate { color: #64748b; }
    
    .ov-stat-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Content Area */
    .ov-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 14px;
    }
    
    .ov-content::-webkit-scrollbar { width: 4px; }
    .ov-content::-webkit-scrollbar-track { background: transparent; }
    .ov-content::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    
    /* Accordion */
    .ov-accordion {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    
    .ov-accordion-trigger {
      width: 100%;
      padding: 10px 12px;
      background: transparent;
      border: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      color: #e2e8f0;
      transition: background 0.15s;
    }
    
    .ov-accordion-trigger:hover { background: #334155; }
    
    .ov-accordion-trigger-left { display: flex; align-items: center; gap: 8px; }
    .ov-accordion-trigger-left span:first-child { font-size: 12px; }
    .ov-accordion-trigger-left span:last-child { font-size: 12px; font-weight: 500; }
    
    .ov-accordion-badge {
      background: #3b82f6;
      color: #fff;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 500;
    }
    
    .ov-accordion-arrow {
      font-size: 10px;
      color: #64748b;
      transition: transform 0.2s;
    }
    
    .ov-accordion-trigger.open .ov-accordion-arrow { transform: rotate(180deg); }
    
    .ov-accordion-content {
      display: none;
      padding: 0 12px 12px;
    }
    
    .ov-accordion-content.open { display: block; }
    
    .ov-links-list { display: flex; flex-direction: column; gap: 6px; }
    
    .ov-link-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: #0f172a;
      border-radius: 4px;
      border: 1px solid #334155;
    }
    
    .ov-link-item:hover { border-color: #475569; }
    
    .ov-link-icon { font-size: 12px; }
    .ov-link-text { flex: 1; min-width: 0; }
    .ov-link-title { font-size: 11px; font-weight: 500; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ov-link-desc { font-size: 9px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    .ov-link-copy {
      font-size: 9px;
      padding: 4px 8px;
      background: #334155;
      border: none;
      border-radius: 4px;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .ov-link-copy:hover { background: #22c55e; color: #fff; }
    
    /* Section */
    .ov-section { margin-bottom: 12px; }
    
    .ov-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #334155;
      margin-bottom: 8px;
    }
    
    .ov-section-title {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .ov-section-count {
      font-size: 10px;
      background: #334155;
      color: #94a3b8;
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .ov-cards { display: flex; flex-direction: column; gap: 8px; }
    
    /* Transaction Card */
    .ov-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 10px 12px;
      border-left: 3px solid #64748b;
    }
    
    .ov-card.boleto { border-left-color: #f59e0b; }
    .ov-card.pix { border-left-color: #22c55e; }
    .ov-card.cartao { border-left-color: #3b82f6; }
    .ov-card.abandoned { border-left-color: #ef4444; }
    
    .ov-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }
    
    .ov-card-info { flex: 1; min-width: 0; }
    
    .ov-card-name {
      font-size: 12px;
      font-weight: 500;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    
    .ov-card-tags { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    
    .ov-tag {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .ov-tag.boleto { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .ov-tag.pix { background: rgba(34,197,94,0.2); color: #22c55e; }
    .ov-tag.cartao { background: rgba(59,130,246,0.2); color: #3b82f6; }
    .ov-tag.gerado, .ov-tag.pendente { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .ov-tag.pago { background: rgba(34,197,94,0.2); color: #22c55e; }
    .ov-tag.abandoned { background: rgba(239,68,68,0.2); color: #ef4444; }
    
    .ov-card-date { font-size: 9px; color: #64748b; }
    
    .ov-card-amount {
      font-size: 14px;
      font-weight: 700;
      color: #22c55e;
      white-space: nowrap;
    }
    
    .ov-card-amount.pending { color: #f59e0b; }
    .ov-card-amount.danger { color: #ef4444; }
    
    /* Barcode */
    .ov-barcode {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #334155;
    }
    
    .ov-barcode-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
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
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-barcode-btn {
      font-size: 9px;
      padding: 4px 10px;
      background: #334155;
      border: none;
      border-radius: 4px;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .ov-barcode-btn:hover { background: #22c55e; color: #fff; }
    
    /* Action Button */
    .ov-action {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #334155;
    }
    
    .ov-action-btn {
      width: 100%;
      padding: 8px;
      background: #334155;
      border: none;
      border-radius: 4px;
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }
    
    .ov-action-btn:hover { background: #22c55e; }
    
    /* Empty State */
    .ov-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
    }
    
    .ov-empty-icon {
      width: 48px;
      height: 48px;
      background: #1e293b;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      margin-bottom: 12px;
    }
    
    .ov-empty-title { font-size: 14px; font-weight: 600; color: #f1f5f9; margin-bottom: 4px; }
    .ov-empty-text { font-size: 12px; color: #64748b; }
    
    /* Loading */
    .ov-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      gap: 12px;
    }
    
    .ov-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #334155;
      border-top-color: #22c55e;
      border-radius: 50%;
      animation: ov-spin 0.6s linear infinite;
    }
    
    @keyframes ov-spin { to { transform: rotate(360deg); } }
    
    .ov-loading-text { font-size: 12px; color: #64748b; }
    
    /* Toast */
    .ov-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 12px;
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
          <span>CRM DASHBOARD</span>
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
    await new Promise(r => setTimeout(r, 300));
    
    // Find new chat button
    let newChatBtn = null;
    for (const sel of ['span[data-icon="new-chat"]', 'span[data-icon="new-chat-outline"]', '[data-testid="menu-bar-new-chat"]']) {
      const el = document.querySelector(sel);
      if (el) { newChatBtn = el.closest('[role="button"]') || el.parentElement || el; break; }
    }
    
    if (!newChatBtn) { console.error('[OV] Botão nova conversa não encontrado'); return false; }
    
    console.log('[OV] Clicando nova conversa...');
    simClick(newChatBtn);
    await new Promise(r => setTimeout(r, 1000));
    
    // Find search input
    let searchInput = null;
    for (const sel of ['div[contenteditable="true"][data-tab="3"]', 'p.selectable-text[data-tab="3"]', '[data-testid="chat-list-search"]']) {
      searchInput = document.querySelector(sel);
      if (searchInput) break;
    }
    
    if (!searchInput) {
      const panel = document.querySelector('#pane-side');
      if (panel) searchInput = panel.querySelector('div[contenteditable="true"]');
    }
    
    if (!searchInput) { console.error('[OV] Campo busca não encontrado'); return false; }
    
    console.log('[OV] Digitando:', formatted);
    searchInput.focus();
    await new Promise(r => setTimeout(r, 200));
    searchInput.textContent = '';
    document.execCommand('insertText', false, formatted);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
    
    await new Promise(r => setTimeout(r, 2500));
    
    console.log('[OV] Procurando contato...');
    
    const searchPanel = document.querySelector('#pane-side');
    if (!searchPanel) { console.error('[OV] Painel não encontrado'); return false; }
    
    const lastDigits = formatted.slice(-8);
    let contactItem = null;
    
    // Find contact
    for (const cell of searchPanel.querySelectorAll('[data-testid="cell-frame-container"], div[tabindex="-1"]')) {
      if ((cell.textContent || '').replace(/\D/g, '').includes(lastDigits)) {
        contactItem = cell;
        break;
      }
    }
    
    if (!contactItem) {
      contactItem = searchPanel.querySelector('[data-testid="cell-frame-container"]') || searchPanel.querySelector('div[tabindex="-1"]');
    }
    
    if (contactItem) {
      console.log('[OV] Clicando contato:', contactItem.textContent?.slice(0, 50));
      simClick(contactItem);
      await new Promise(r => setTimeout(r, 500));
      
      const opened = document.querySelector('[data-testid="conversation-compose-box-input"]');
      if (opened) { console.log('[OV] Chat aberto com sucesso!'); return true; }
      
      // Try child elements
      for (const target of [contactItem.querySelector('span'), contactItem.firstElementChild].filter(Boolean)) {
        simClick(target);
        await new Promise(r => setTimeout(r, 300));
        if (document.querySelector('[data-testid="conversation-compose-box-input"]')) {
          console.log('[OV] Chat aberto após retry!');
          return true;
        }
      }
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
