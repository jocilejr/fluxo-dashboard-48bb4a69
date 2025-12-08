// Content Script - WhatsApp Web
// Dashboard Premium + Recuperação de Leads

console.log('[OV] Content script carregado');

// ========== CONFIG ==========
const API_URL = 'https://suaznqybxvborpkrtdpm.supabase.co/functions/v1/whatsapp-dashboard';
const SIDEBAR_WIDTH = 340;

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
  
  // Remove country code if present
  if (base.startsWith('55') && base.length >= 12) {
    base = base.slice(2);
  }
  
  // Remove 9th digit if present (11 digits = DDD + 9 + 8)
  if (base.length === 11 && base[2] === '9') {
    base = base.slice(0, 2) + base.slice(3);
  }
  
  // Generate all variations from 10-digit base
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
    if (!digits.startsWith('55')) {
      variations.add('55' + digits);
    }
  }
  
  return Array.from(variations);
}

function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  
  // Already has country code
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  
  // Add country code
  if (digits.length >= 10 && digits.length <= 11) {
    return '55' + digits;
  }
  
  return digits;
}

function formatDisplayPhone(phone) {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,8)}-${d.slice(8)}`;
  }
  return phone;
}

// ========== CSS - DARK PREMIUM DESIGN ==========
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
      background: #111827;
      border-left: 1px solid rgba(255,255,255,0.08);
      z-index: 99999;
      font-family: 'Inter', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease;
      box-shadow: -4px 0 24px rgba(0,0,0,0.5);
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
      background: #1f2937;
      border: 1px solid rgba(255,255,255,0.1);
      border-right: none;
      border-radius: 8px 0 0 8px;
      padding: 12px 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    #ov-toggle:hover { background: #374151; padding-right: 12px; }
    body.ov-open #ov-toggle { right: ${SIDEBAR_WIDTH}px; }
    .ov-toggle-icon { font-size: 10px; color: #9ca3af; }
    
    /* Header */
    .ov-head {
      padding: 14px 16px;
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .ov-brand { display: flex; align-items: center; gap: 10px; }
    
    .ov-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      overflow: hidden;
      background: rgba(16,185,129,0.1);
      border: 1px solid rgba(16,185,129,0.2);
    }
    
    .ov-logo img { width: 100%; height: 100%; object-fit: cover; }
    
    .ov-brand-info { display: flex; flex-direction: column; gap: 1px; }
    .ov-brand-name { font-size: 13px; font-weight: 600; color: #f9fafb; }
    .ov-brand-sub { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .ov-close {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: #374151;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      transition: all 0.15s;
    }
    
    .ov-close:hover { background: #dc2626; color: #fff; }
    
    /* Profile */
    .ov-profile {
      padding: 16px;
      background: #1f2937;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    
    .ov-profile-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    
    .ov-avatar {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(16,185,129,0.3);
    }
    
    .ov-info { flex: 1; min-width: 0; }
    .ov-name { font-size: 14px; font-weight: 600; color: #f9fafb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
    .ov-phone { font-size: 11px; color: #9ca3af; font-family: 'SF Mono', Monaco, monospace; display: flex; align-items: center; gap: 6px; }
    .ov-copy { background: none; border: none; cursor: pointer; color: #6b7280; font-size: 10px; transition: color 0.15s; }
    .ov-copy:hover { color: #10b981; }
    
    /* Stats */
    .ov-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    
    .ov-stat {
      background: #111827;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
      transition: all 0.15s;
    }
    
    .ov-stat:hover { border-color: rgba(255,255,255,0.12); }
    
    .ov-stat-val { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
    .ov-stat-val.green { color: #10b981; }
    .ov-stat-val.yellow { color: #f59e0b; }
    .ov-stat-val.red { color: #ef4444; }
    .ov-stat-val.gray { color: #6b7280; }
    
    .ov-stat-lbl { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
    
    /* Content */
    .ov-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 14px 16px;
    }
    
    .ov-body::-webkit-scrollbar { width: 4px; }
    .ov-body::-webkit-scrollbar-track { background: transparent; }
    .ov-body::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
    
    /* Accordion */
    .ov-acc {
      margin-bottom: 16px;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      overflow: hidden;
    }
    
    .ov-acc-head {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #1f2937;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    
    .ov-acc-head:hover { background: #374151; }
    
    .ov-acc-left { display: flex; align-items: center; gap: 8px; }
    .ov-acc-icon { width: 24px; height: 24px; border-radius: 6px; background: rgba(59,130,246,0.1); display: flex; align-items: center; justify-content: center; font-size: 11px; }
    .ov-acc-title { font-size: 11px; font-weight: 600; color: #f9fafb; }
    .ov-acc-badge { font-size: 9px; background: rgba(59,130,246,0.15); color: #3b82f6; padding: 2px 6px; border-radius: 8px; }
    .ov-acc-arrow { font-size: 9px; color: #6b7280; transition: transform 0.2s; }
    .ov-acc-head.open .ov-acc-arrow { transform: rotate(180deg); }
    
    .ov-acc-body { display: none; background: #111827; padding: 10px; }
    .ov-acc-body.open { display: block; }
    
    .ov-links { display: flex; flex-direction: column; gap: 6px; }
    
    .ov-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: #1f2937;
      border-radius: 6px;
      transition: background 0.15s;
    }
    
    .ov-link:hover { background: #374151; }
    .ov-link-icon { width: 20px; height: 20px; border-radius: 4px; background: rgba(59,130,246,0.1); display: flex; align-items: center; justify-content: center; font-size: 9px; }
    .ov-link-info { flex: 1; min-width: 0; }
    .ov-link-name { font-size: 10px; font-weight: 500; color: #f9fafb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ov-link-desc { font-size: 8px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ov-link-btn { font-size: 8px; padding: 3px 8px; background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #9ca3af; cursor: pointer; transition: all 0.15s; }
    .ov-link-btn:hover { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: #10b981; }
    
    /* Section */
    .ov-section { margin-bottom: 16px; }
    .ov-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .ov-section-title { font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 5px; }
    .ov-section-count { font-size: 9px; background: #374151; color: #9ca3af; padding: 2px 6px; border-radius: 8px; }
    
    .ov-list { display: flex; flex-direction: column; gap: 6px; }
    
    /* Transaction Card */
    .ov-card {
      background: #1f2937;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      padding: 10px 12px;
      transition: all 0.15s;
    }
    
    .ov-card:hover { border-color: rgba(255,255,255,0.12); }
    .ov-card.boleto { border-left: 3px solid #f59e0b; }
    .ov-card.pix { border-left: 3px solid #10b981; }
    .ov-card.cartao { border-left: 3px solid #3b82f6; }
    .ov-card.abandoned { border-left: 3px solid #ef4444; }
    
    .ov-card-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .ov-card-info { flex: 1; min-width: 0; }
    .ov-card-product { font-size: 11px; font-weight: 500; color: #f9fafb; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ov-card-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    
    .ov-tag { font-size: 8px; padding: 2px 5px; border-radius: 4px; font-weight: 500; text-transform: uppercase; }
    .ov-tag.boleto { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .ov-tag.pix { background: rgba(16,185,129,0.15); color: #10b981; }
    .ov-tag.cartao { background: rgba(59,130,246,0.15); color: #3b82f6; }
    .ov-tag.gerado, .ov-tag.pendente { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .ov-tag.pago { background: rgba(16,185,129,0.15); color: #10b981; }
    .ov-tag.abandoned { background: rgba(239,68,68,0.15); color: #ef4444; }
    
    .ov-card-date { font-size: 8px; color: #6b7280; }
    .ov-card-amount { font-size: 13px; font-weight: 700; color: #10b981; white-space: nowrap; }
    .ov-card-amount.pending { color: #f59e0b; }
    .ov-card-amount.danger { color: #ef4444; }
    
    /* Barcode */
    .ov-barcode { margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); }
    .ov-barcode-lbl { font-size: 8px; color: #6b7280; text-transform: uppercase; margin-bottom: 3px; }
    .ov-barcode-row { display: flex; align-items: center; gap: 6px; }
    .ov-barcode-val { flex: 1; font-size: 9px; font-family: 'SF Mono', Monaco, monospace; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ov-barcode-copy { font-size: 8px; padding: 3px 8px; background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #9ca3af; cursor: pointer; transition: all 0.15s; }
    .ov-barcode-copy:hover { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: #10b981; }
    
    /* Action */
    .ov-action { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); }
    .ov-action-btn {
      width: 100%;
      padding: 7px 10px;
      background: #111827;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      color: #9ca3af;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    
    .ov-action-btn:hover { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: #10b981; }
    
    /* Empty */
    .ov-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; }
    .ov-empty-icon { width: 40px; height: 40px; border-radius: 50%; background: #374151; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 12px; }
    .ov-empty-title { font-size: 13px; font-weight: 600; color: #f9fafb; margin-bottom: 4px; }
    .ov-empty-text { font-size: 11px; color: #6b7280; line-height: 1.4; max-width: 200px; }
    
    /* Loading */
    .ov-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; gap: 10px; }
    .ov-spinner { width: 20px; height: 20px; border: 2px solid #374151; border-top-color: #10b981; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .ov-loading-text { font-size: 11px; color: #6b7280; }
    
    /* Toast */
    .ov-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      border: 1px solid rgba(255,255,255,0.1);
      color: #f9fafb;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      animation: toast-in 0.2s ease;
    }
    
    @keyframes toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
    <div class="ov-head">
      <div class="ov-brand">
        <div class="ov-logo"><img src="${logoUrl}" alt="" /></div>
        <div class="ov-brand-info">
          <div class="ov-brand-name">Origem Viva</div>
          <div class="ov-brand-sub">CRM Dashboard</div>
        </div>
      </div>
      <button class="ov-close" onclick="toggleSidebar()">✕</button>
    </div>
    <div class="ov-body" id="ov-content"></div>
  `;
  
  document.body.appendChild(panel);
}

function createToggleButton() {
  if (document.getElementById('ov-toggle')) return;
  
  const btn = document.createElement('button');
  btn.id = 'ov-toggle';
  btn.innerHTML = `<span class="ov-toggle-icon">◀</span>`;
  btn.onclick = toggleSidebar;
  document.body.appendChild(btn);
}

function toggleSidebar() {
  const panel = document.getElementById('ov-panel');
  if (!panel) return;
  
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    document.body.classList.add('ov-open');
    sidebarVisible = true;
    document.getElementById('ov-toggle').innerHTML = `<span class="ov-toggle-icon">▶</span>`;
    if (currentPhone) loadLeadData(currentPhone);
    else renderContent();
  } else {
    panel.classList.add('hidden');
    document.body.classList.remove('ov-open');
    sidebarVisible = false;
    document.getElementById('ov-toggle').innerHTML = `<span class="ov-toggle-icon">◀</span>`;
  }
}

window.toggleSidebar = toggleSidebar;

// ========== RENDER ==========
function renderContent() {
  const container = document.getElementById('ov-content');
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
  const paidTxs = transactions.filter(t => t.status === 'pago');
  const pendingTxs = transactions.filter(t => ['gerado', 'pendente'].includes(t.status));
  const totalPaid = paidTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalPending = pendingTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  
  const displayPhone = formatDisplayPhone(currentPhone);
  const name = customer?.name || transactions[0]?.customer_name || abandoned[0]?.customer_name || 'Lead';
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  
  let html = `
    <div class="ov-profile">
      <div class="ov-profile-row">
        <div class="ov-avatar">${initials || '?'}</div>
        <div class="ov-info">
          <div class="ov-name">${name}</div>
          <div class="ov-phone">
            <span>${displayPhone}</span>
            <button class="ov-copy" data-copy="${currentPhone}" title="Copiar">📋</button>
          </div>
        </div>
      </div>
      <div class="ov-stats">
        <div class="ov-stat"><div class="ov-stat-val green">${formatCurrency(totalPaid)}</div><div class="ov-stat-lbl">Total Pago</div></div>
        <div class="ov-stat"><div class="ov-stat-val yellow">${formatCurrency(totalPending)}</div><div class="ov-stat-lbl">Pendente</div></div>
        <div class="ov-stat"><div class="ov-stat-val gray">${transactions.length}</div><div class="ov-stat-lbl">Transações</div></div>
        <div class="ov-stat"><div class="ov-stat-val red">${abandoned.length}</div><div class="ov-stat-lbl">Abandonos</div></div>
      </div>
    </div>
  `;
  
  // Links Accordion
  if (usefulLinks.length > 0) {
    html += `
      <div class="ov-acc">
        <button class="ov-acc-head" id="ov-links-trigger">
          <div class="ov-acc-left">
            <div class="ov-acc-icon">🔗</div>
            <span class="ov-acc-title">Links Úteis</span>
            <span class="ov-acc-badge">${usefulLinks.length}</span>
          </div>
          <span class="ov-acc-arrow">▼</span>
        </button>
        <div class="ov-acc-body" id="ov-links-panel">
          <div class="ov-links">
            ${usefulLinks.map(l => `
              <div class="ov-link">
                <div class="ov-link-icon">🌐</div>
                <div class="ov-link-info">
                  <div class="ov-link-name">${l.title}</div>
                  ${l.description ? `<div class="ov-link-desc">${l.description}</div>` : ''}
                </div>
                <button class="ov-link-btn" data-copy="${l.url}">Copiar</button>
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
        <div class="ov-section-head">
          <span class="ov-section-title">📋 Transações</span>
          <span class="ov-section-count">${transactions.length}</span>
        </div>
        <div class="ov-list">${transactions.map(renderTxCard).join('')}</div>
      </div>
    `;
  }
  
  // Abandoned
  if (abandoned.length > 0) {
    html += `
      <div class="ov-section">
        <div class="ov-section-head">
          <span class="ov-section-title">⚠️ Abandonos</span>
          <span class="ov-section-count">${abandoned.length}</span>
        </div>
        <div class="ov-list">${abandoned.map(renderAbCard).join('')}</div>
      </div>
    `;
  }
  
  // Empty
  if (transactions.length === 0 && abandoned.length === 0) {
    html += `
      <div class="ov-empty" style="padding: 28px 16px;">
        <div class="ov-empty-icon">📭</div>
        <div class="ov-empty-title">Sem histórico</div>
        <div class="ov-empty-text">Nenhum registro encontrado</div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Events
  container.querySelectorAll('[data-copy]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      copyToClipboard(el.dataset.copy);
    });
  });
  
  const trigger = document.getElementById('ov-links-trigger');
  const panel = document.getElementById('ov-links-panel');
  if (trigger && panel) {
    trigger.onclick = () => {
      trigger.classList.toggle('open');
      panel.classList.toggle('open');
    };
  }
}

function renderTxCard(tx) {
  const boletoUrl = tx.metadata?.boleto_url || tx.metadata?.boletoUrl;
  const barcode = tx.external_id;
  const isPending = ['gerado', 'pendente'].includes(tx.status);
  
  let html = `
    <div class="ov-card ${tx.type}">
      <div class="ov-card-row">
        <div class="ov-card-info">
          <div class="ov-card-product">${tx.description || tx.customer_name || 'Transação'}</div>
          <div class="ov-card-meta">
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
        <div class="ov-barcode-lbl">Código de barras</div>
        <div class="ov-barcode-row">
          <div class="ov-barcode-val">${barcode}</div>
          <button class="ov-barcode-copy" data-copy="${barcode}">Copiar</button>
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
      <div class="ov-card-row">
        <div class="ov-card-info">
          <div class="ov-card-product">${ab.product_name || ab.event_type || 'Abandono'}</div>
          <div class="ov-card-meta">
            <span class="ov-tag abandoned">${ab.event_type || 'abandono'}</span>
            ${ab.funnel_stage ? `<span class="ov-tag" style="background:#374151;color:#9ca3af;">${ab.funnel_stage}</span>` : ''}
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
  const existing = document.querySelector('.ov-toast');
  if (existing) existing.remove();
  
  const t = document.createElement('div');
  t.className = 'ov-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
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
  
  const container = document.getElementById('ov-content');
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
    if (container) {
      container.innerHTML = `<div class="ov-empty"><div class="ov-empty-icon">❌</div><div class="ov-empty-title">Erro</div></div>`;
    }
  }
}

// ========== PHONE DETECTION ==========
function extractPhoneFromConversation() {
  // Try header spans first
  const headerSpans = document.querySelectorAll('header span[title], header span[dir="auto"]');
  for (const span of headerSpans) {
    const text = span.getAttribute('title') || span.textContent || '';
    const phone = extractPhoneFromText(text);
    if (phone) return phone;
  }
  
  // Try conversation title
  const title = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
  if (title) {
    const phone = extractPhoneFromText(title.textContent || '');
    if (phone) return phone;
  }
  
  // Try JID
  const jidEls = document.querySelectorAll('[data-jid]');
  for (const el of jidEls) {
    const jid = el.getAttribute('data-jid');
    if (jid && jid.includes('@')) {
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
    const app = document.querySelector('#app, [data-testid="chat-list"]');
    if (app) {
      clearInterval(waitForApp);
      observer.observe(document.body, { childList: true, subtree: true });
      check();
    }
  }, 500);
}

// ========== SIMULATED CLICK (WhatsApp Web compatible) ==========
function simulatedClick(target, options = {}) {
  if (!target || !target.ownerDocument) return;
  
  const event = target.ownerDocument.createEvent('MouseEvents');
  const opts = {
    type: 'click',
    canBubble: true,
    cancelable: true,
    view: target.ownerDocument.defaultView,
    detail: 1,
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    button: 0,
    relatedTarget: null,
    ...options
  };
  
  event.initMouseEvent(
    opts.type, opts.canBubble, opts.cancelable, opts.view, opts.detail,
    opts.screenX, opts.screenY, opts.clientX, opts.clientY,
    opts.ctrlKey, opts.altKey, opts.shiftKey, opts.metaKey,
    opts.button, opts.relatedTarget
  );
  
  target.dispatchEvent(event);
}

function simClick(target) {
  if (!target) return;
  
  // Get center coordinates
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  const coords = { clientX: x, clientY: y, screenX: x, screenY: y };
  
  simulatedClick(target, { type: 'mousedown', ...coords });
  simulatedClick(target, { type: 'mouseup', ...coords });
  simulatedClick(target, { type: 'click', ...coords });
}

// ========== OPEN CHAT ==========
async function openChat(phone) {
  const formatted = formatPhoneForWhatsApp(phone);
  console.log('[OV] Abrindo chat:', formatted);
  
  try {
    await new Promise(r => setTimeout(r, 300));
    
    // Find new chat button
    const newChatSelectors = [
      'span[data-icon="new-chat"]',
      'span[data-icon="new-chat-outline"]',
      '[data-testid="menu-bar-new-chat"]',
      'div[title="Nova conversa"]',
      '[aria-label="Nova conversa"]'
    ];
    
    let newChatBtn = null;
    for (const sel of newChatSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        newChatBtn = el.closest('[role="button"]') || el.parentElement || el;
        break;
      }
    }
    
    if (!newChatBtn) {
      console.error('[OV] Botão nova conversa não encontrado');
      return false;
    }
    
    console.log('[OV] Clicando nova conversa...');
    simClick(newChatBtn);
    await new Promise(r => setTimeout(r, 1000));
    
    // Find search input
    const searchSelectors = [
      'div[contenteditable="true"][data-tab="3"]',
      'p.selectable-text[data-tab="3"]',
      '[data-testid="chat-list-search"]',
      'div[contenteditable="true"][role="textbox"]'
    ];
    
    let searchInput = null;
    for (const sel of searchSelectors) {
      searchInput = document.querySelector(sel);
      if (searchInput) break;
    }
    
    // Fallback
    if (!searchInput) {
      const panel = document.querySelector('[data-testid="chat-list"]') || document.querySelector('#pane-side');
      if (panel) {
        searchInput = panel.querySelector('div[contenteditable="true"]') || panel.querySelector('p[contenteditable="true"]');
      }
    }
    
    if (!searchInput) {
      console.error('[OV] Campo busca não encontrado');
      return false;
    }
    
    console.log('[OV] Digitando:', formatted);
    searchInput.focus();
    await new Promise(r => setTimeout(r, 200));
    
    // Clear and type
    searchInput.textContent = '';
    document.execCommand('insertText', false, formatted);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    
    await new Promise(r => setTimeout(r, 2500));
    
    console.log('[OV] Procurando contato...');
    
    // Find contact in list
    const searchPanel = document.querySelector('[data-testid="chat-list"]') || 
                        document.querySelector('#pane-side') ||
                        document.querySelector('[aria-label="Lista de conversas"]');
    
    if (!searchPanel) {
      console.error('[OV] Painel não encontrado');
      return false;
    }
    
    // Try to find clickable contact
    const lastDigits = formatted.slice(-8);
    let contactItem = null;
    
    // Method 1: Find by data-testid cell-frame-container
    const cells = searchPanel.querySelectorAll('[data-testid="cell-frame-container"]');
    for (const cell of cells) {
      const text = cell.textContent || '';
      if (text.replace(/\D/g, '').includes(lastDigits)) {
        contactItem = cell;
        break;
      }
    }
    
    // Method 2: Find by listitem role
    if (!contactItem) {
      const listitems = searchPanel.querySelectorAll('[role="listitem"], [role="option"], [role="row"]');
      for (const item of listitems) {
        const text = item.textContent || '';
        if (text.replace(/\D/g, '').includes(lastDigits)) {
          contactItem = item;
          break;
        }
      }
    }
    
    // Method 3: Find by tabindex
    if (!contactItem) {
      const tabItems = searchPanel.querySelectorAll('div[tabindex="-1"]');
      for (const item of tabItems) {
        const text = item.textContent || '';
        if (text.replace(/\D/g, '').includes(lastDigits) && text.length < 500) {
          contactItem = item;
          break;
        }
      }
    }
    
    // Fallback: first visible result
    if (!contactItem) {
      contactItem = searchPanel.querySelector('[data-testid="cell-frame-container"]') ||
                    searchPanel.querySelector('div[tabindex="-1"]');
    }
    
    if (contactItem) {
      console.log('[OV] Clicando contato:', contactItem.textContent?.slice(0, 50));
      
      // Try clicking the element and its children
      simClick(contactItem);
      await new Promise(r => setTimeout(r, 500));
      
      // Check if chat opened
      const chatOpened = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                         document.querySelector('footer div[contenteditable="true"]');
      
      if (chatOpened) {
        console.log('[OV] Chat aberto com sucesso!');
        return true;
      }
      
      // Try clicking child elements
      const clickTargets = [
        contactItem.querySelector('[data-testid="cell-frame-container"]'),
        contactItem.querySelector('span'),
        contactItem.querySelector('div > div'),
        contactItem.firstElementChild
      ].filter(Boolean);
      
      for (const target of clickTargets) {
        simClick(target);
        await new Promise(r => setTimeout(r, 300));
        
        const opened = document.querySelector('[data-testid="conversation-compose-box-input"]');
        if (opened) {
          console.log('[OV] Chat aberto após retry!');
          return true;
        }
      }
      
      return true;
    }
    
    console.error('[OV] Contato não encontrado na lista');
    return false;
    
  } catch (err) {
    console.error('[OV] Erro ao abrir chat:', err);
    return false;
  }
}

async function sendTextMessage(text) {
  try {
    const input = document.querySelector('[data-testid="conversation-compose-box-input"], footer [contenteditable="true"]');
    if (!input) return false;
    
    input.focus();
    input.textContent = '';
    
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      document.execCommand('insertText', false, lines[i]);
      if (i < lines.length - 1) document.execCommand('insertLineBreak');
    }
    
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
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
  
  sendResponse({ success: false, error: 'Unknown action' });
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
