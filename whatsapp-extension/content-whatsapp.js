// Content Script - WhatsApp Web
// Executa ações na interface do WhatsApp + Mini Dashboard Corporativo Premium

console.log('[WhatsApp Extension] Content script carregado');

// ========== CONFIGURAÇÃO ==========
const API_URL = 'https://suaznqybxvborpkrtdpm.supabase.co/functions/v1/whatsapp-dashboard';
const SIDEBAR_WIDTH = 360;

// ========== ESTADO GLOBAL ==========
let currentPhone = null;
let sidebarVisible = false;
let currentLeadData = null;

// Registra no background
chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('[WhatsApp Extension] Erro ao registrar:', chrome.runtime.lastError);
  } else {
    console.log('[WhatsApp Extension] Registrado no background');
  }
});

// ========== NORMALIZAÇÃO DE TELEFONE ==========
function normalizePhoneForMatching(phone) {
  if (!phone) return null;
  
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  
  // Remove código do país se presente
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  // Remove o 9º dígito se tiver 11 dígitos (DDD + 9 + 8 dígitos)
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  return digits;
}

function generatePhoneVariations(phone) {
  if (!phone) return [];
  
  const originalDigits = phone.replace(/\D/g, '');
  if (originalDigits.length < 8) return [];
  
  const variations = new Set();
  
  // Normaliza para base (DDD + 8 dígitos)
  let base = originalDigits;
  
  // Remove 55 se presente
  if (base.startsWith('55') && base.length >= 12) {
    base = base.slice(2);
  }
  
  // Remove 9º dígito se presente
  if (base.length === 11 && base[2] === '9') {
    base = base.slice(0, 2) + base.slice(3);
  }
  
  // Se ainda tem 11 dígitos, tenta remover
  if (base.length === 11) {
    base = base.slice(0, 2) + base.slice(3);
  }
  
  // Gera variações a partir da base
  if (base.length === 10) {
    const ddd = base.slice(0, 2);
    const number = base.slice(2);
    const with9 = ddd + '9' + number;
    
    variations.add(base);           // DDD + 8 dígitos
    variations.add(with9);          // DDD + 9 + 8 dígitos  
    variations.add('55' + base);    // 55 + DDD + 8 dígitos
    variations.add('55' + with9);   // 55 + DDD + 9 + 8 dígitos
  }
  
  return Array.from(variations);
}

// ========== CSS DESIGN SYSTEM - ENTERPRISE PREMIUM ==========
function injectStyles() {
  if (document.getElementById('ov-dashboard-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'ov-dashboard-styles';
  styles.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    :root {
      --ov-bg-base: #09090b;
      --ov-bg-subtle: #18181b;
      --ov-bg-muted: #27272a;
      --ov-bg-elevated: #3f3f46;
      --ov-border-subtle: rgba(255,255,255,0.06);
      --ov-border-default: rgba(255,255,255,0.1);
      --ov-border-strong: rgba(255,255,255,0.2);
      --ov-text-primary: #fafafa;
      --ov-text-secondary: #a1a1aa;
      --ov-text-muted: #71717a;
      --ov-brand: #10b981;
      --ov-brand-dark: #059669;
      --ov-brand-glow: rgba(16, 185, 129, 0.15);
      --ov-warning: #f59e0b;
      --ov-warning-glow: rgba(245, 158, 11, 0.15);
      --ov-danger: #ef4444;
      --ov-danger-glow: rgba(239, 68, 68, 0.15);
      --ov-info: #3b82f6;
      --ov-radius-sm: 6px;
      --ov-radius-md: 10px;
      --ov-radius-lg: 14px;
      --ov-shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
      --ov-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
      --ov-shadow-lg: 0 12px 40px rgba(0,0,0,0.5);
    }
    
    body.ov-sidebar-open #app {
      width: calc(100% - ${SIDEBAR_WIDTH}px) !important;
      transition: width 0.25s ease;
    }
    
    #ov-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: ${SIDEBAR_WIDTH}px;
      height: 100vh;
      background: var(--ov-bg-base);
      border-left: 1px solid var(--ov-border-subtle);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: transform 0.25s ease;
      box-shadow: -8px 0 32px rgba(0,0,0,0.6);
    }
    
    #ov-sidebar.hidden { transform: translateX(100%); }
    #ov-sidebar * { box-sizing: border-box; margin: 0; padding: 0; }
    
    /* ====== HEADER ====== */
    .ov-header {
      padding: 16px 20px;
      background: linear-gradient(180deg, var(--ov-bg-subtle) 0%, var(--ov-bg-base) 100%);
      border-bottom: 1px solid var(--ov-border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .ov-header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .ov-logo {
      width: 36px;
      height: 36px;
      border-radius: var(--ov-radius-md);
      overflow: hidden;
      background: var(--ov-brand-glow);
      border: 1px solid rgba(16,185,129,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .ov-logo img { width: 100%; height: 100%; object-fit: cover; }
    
    .ov-brand-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    
    .ov-brand-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--ov-text-primary);
      letter-spacing: -0.3px;
    }
    
    .ov-brand-label {
      font-size: 10px;
      color: var(--ov-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .ov-close {
      width: 28px;
      height: 28px;
      border-radius: var(--ov-radius-sm);
      background: var(--ov-bg-muted);
      border: 1px solid var(--ov-border-subtle);
      color: var(--ov-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.15s ease;
    }
    
    .ov-close:hover {
      background: var(--ov-danger-glow);
      border-color: rgba(239,68,68,0.3);
      color: var(--ov-danger);
    }
    
    /* ====== PROFILE CARD ====== */
    .ov-profile {
      padding: 20px;
      background: var(--ov-bg-subtle);
      border-bottom: 1px solid var(--ov-border-subtle);
    }
    
    .ov-profile-main {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }
    
    .ov-avatar {
      width: 48px;
      height: 48px;
      border-radius: var(--ov-radius-lg);
      background: linear-gradient(135deg, var(--ov-brand) 0%, var(--ov-brand-dark) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      box-shadow: 0 4px 16px rgba(16,185,129,0.3);
      flex-shrink: 0;
    }
    
    .ov-profile-info { flex: 1; min-width: 0; }
    
    .ov-profile-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--ov-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 3px;
    }
    
    .ov-profile-phone {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .ov-phone-text {
      font-size: 12px;
      color: var(--ov-text-secondary);
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    }
    
    .ov-copy-btn {
      background: none;
      border: none;
      padding: 2px;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.15s;
      font-size: 10px;
      color: var(--ov-text-muted);
    }
    
    .ov-copy-btn:hover { opacity: 1; color: var(--ov-brand); }
    
    /* ====== STATS GRID ====== */
    .ov-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    
    .ov-stat {
      background: var(--ov-bg-base);
      border: 1px solid var(--ov-border-subtle);
      border-radius: var(--ov-radius-md);
      padding: 12px;
      text-align: center;
      transition: all 0.15s ease;
    }
    
    .ov-stat:hover {
      border-color: var(--ov-border-default);
      background: var(--ov-bg-muted);
    }
    
    .ov-stat-value {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 2px;
    }
    
    .ov-stat-value.brand { color: var(--ov-brand); }
    .ov-stat-value.warning { color: var(--ov-warning); }
    .ov-stat-value.danger { color: var(--ov-danger); }
    .ov-stat-value.muted { color: var(--ov-text-muted); }
    
    .ov-stat-label {
      font-size: 9px;
      color: var(--ov-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 500;
    }
    
    /* ====== CONTENT AREA ====== */
    .ov-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px 20px;
    }
    
    .ov-content::-webkit-scrollbar { width: 4px; }
    .ov-content::-webkit-scrollbar-track { background: transparent; }
    .ov-content::-webkit-scrollbar-thumb { background: var(--ov-bg-elevated); border-radius: 2px; }
    
    /* ====== ACCORDION ====== */
    .ov-accordion {
      margin-bottom: 20px;
      border-radius: var(--ov-radius-md);
      overflow: hidden;
      border: 1px solid var(--ov-border-subtle);
    }
    
    .ov-accordion-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: var(--ov-bg-subtle);
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .ov-accordion-header:hover { background: var(--ov-bg-muted); }
    
    .ov-accordion-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .ov-accordion-icon {
      width: 28px;
      height: 28px;
      border-radius: var(--ov-radius-sm);
      background: rgba(59,130,246,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    
    .ov-accordion-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--ov-text-primary);
    }
    
    .ov-accordion-badge {
      font-size: 10px;
      background: rgba(59,130,246,0.15);
      color: var(--ov-info);
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }
    
    .ov-accordion-arrow {
      font-size: 10px;
      color: var(--ov-text-muted);
      transition: transform 0.2s ease;
    }
    
    .ov-accordion-header.open .ov-accordion-arrow { transform: rotate(180deg); }
    
    .ov-accordion-body {
      display: none;
      background: var(--ov-bg-base);
      border-top: 1px solid var(--ov-border-subtle);
    }
    
    .ov-accordion-body.open { display: block; }
    
    .ov-links-list { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
    
    .ov-link-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--ov-bg-subtle);
      border-radius: var(--ov-radius-sm);
      transition: all 0.15s ease;
    }
    
    .ov-link-row:hover { background: var(--ov-bg-muted); }
    
    .ov-link-icon {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: rgba(59,130,246,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      flex-shrink: 0;
    }
    
    .ov-link-info { flex: 1; min-width: 0; }
    
    .ov-link-name {
      font-size: 11px;
      font-weight: 500;
      color: var(--ov-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-link-desc {
      font-size: 9px;
      color: var(--ov-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-link-copy {
      font-size: 9px;
      padding: 4px 10px;
      background: var(--ov-bg-base);
      border: 1px solid var(--ov-border-subtle);
      border-radius: 4px;
      color: var(--ov-text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    
    .ov-link-copy:hover {
      background: var(--ov-brand-glow);
      border-color: rgba(16,185,129,0.3);
      color: var(--ov-brand);
    }
    
    /* ====== SECTION ====== */
    .ov-section { margin-bottom: 20px; }
    
    .ov-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--ov-border-subtle);
    }
    
    .ov-section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--ov-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .ov-section-count {
      font-size: 10px;
      background: var(--ov-bg-muted);
      color: var(--ov-text-muted);
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }
    
    .ov-tx-list { display: flex; flex-direction: column; gap: 8px; }
    
    /* ====== TRANSACTION CARD ====== */
    .ov-tx {
      background: var(--ov-bg-subtle);
      border: 1px solid var(--ov-border-subtle);
      border-radius: var(--ov-radius-md);
      padding: 12px;
      transition: all 0.15s ease;
    }
    
    .ov-tx:hover {
      border-color: var(--ov-border-default);
      background: var(--ov-bg-muted);
    }
    
    .ov-tx.boleto { border-left: 3px solid var(--ov-warning); }
    .ov-tx.pix { border-left: 3px solid var(--ov-brand); }
    .ov-tx.cartao { border-left: 3px solid var(--ov-info); }
    .ov-tx.abandoned { border-left: 3px solid var(--ov-danger); }
    
    .ov-tx-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    
    .ov-tx-info { flex: 1; min-width: 0; }
    
    .ov-tx-product {
      font-size: 12px;
      font-weight: 500;
      color: var(--ov-text-primary);
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-tx-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    
    .ov-badge {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .ov-badge.boleto { background: var(--ov-warning-glow); color: var(--ov-warning); }
    .ov-badge.pix { background: var(--ov-brand-glow); color: var(--ov-brand); }
    .ov-badge.cartao { background: rgba(59,130,246,0.15); color: var(--ov-info); }
    .ov-badge.gerado { background: var(--ov-warning-glow); color: var(--ov-warning); }
    .ov-badge.pago { background: var(--ov-brand-glow); color: var(--ov-brand); }
    .ov-badge.pendente { background: var(--ov-warning-glow); color: var(--ov-warning); }
    .ov-badge.abandoned { background: var(--ov-danger-glow); color: var(--ov-danger); }
    
    .ov-tx-date {
      font-size: 9px;
      color: var(--ov-text-muted);
    }
    
    .ov-tx-amount {
      font-size: 14px;
      font-weight: 700;
      color: var(--ov-brand);
      white-space: nowrap;
    }
    
    .ov-tx-amount.pending { color: var(--ov-warning); }
    .ov-tx-amount.danger { color: var(--ov-danger); }
    
    /* ====== BARCODE ====== */
    .ov-barcode {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--ov-border-subtle);
    }
    
    .ov-barcode-label {
      font-size: 9px;
      color: var(--ov-text-muted);
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
      color: var(--ov-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-barcode-copy {
      font-size: 9px;
      padding: 4px 10px;
      background: var(--ov-bg-base);
      border: 1px solid var(--ov-border-subtle);
      border-radius: 4px;
      color: var(--ov-text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .ov-barcode-copy:hover {
      background: var(--ov-brand-glow);
      border-color: rgba(16,185,129,0.3);
      color: var(--ov-brand);
    }
    
    /* ====== ACTION BUTTON ====== */
    .ov-tx-actions {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--ov-border-subtle);
    }
    
    .ov-action-btn {
      width: 100%;
      padding: 8px 12px;
      background: var(--ov-bg-base);
      border: 1px solid var(--ov-border-subtle);
      border-radius: var(--ov-radius-sm);
      color: var(--ov-text-secondary);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    
    .ov-action-btn:hover {
      background: var(--ov-brand-glow);
      border-color: rgba(16,185,129,0.3);
      color: var(--ov-brand);
    }
    
    /* ====== EMPTY STATE ====== */
    .ov-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
    }
    
    .ov-empty-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--ov-bg-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      margin-bottom: 14px;
    }
    
    .ov-empty-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--ov-text-primary);
      margin-bottom: 6px;
    }
    
    .ov-empty-text {
      font-size: 12px;
      color: var(--ov-text-muted);
      line-height: 1.5;
      max-width: 220px;
    }
    
    /* ====== LOADING ====== */
    .ov-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 12px;
    }
    
    .ov-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--ov-bg-muted);
      border-top-color: var(--ov-brand);
      border-radius: 50%;
      animation: ov-spin 0.8s linear infinite;
    }
    
    @keyframes ov-spin { to { transform: rotate(360deg); } }
    
    .ov-loading-text {
      font-size: 12px;
      color: var(--ov-text-muted);
    }
    
    /* ====== TOGGLE BUTTON ====== */
    #ov-toggle-btn {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      z-index: 99998;
      background: var(--ov-bg-subtle);
      border: 1px solid var(--ov-border-subtle);
      border-right: none;
      border-radius: 8px 0 0 8px;
      padding: 10px 6px;
      cursor: pointer;
      box-shadow: var(--ov-shadow-md);
      transition: all 0.2s ease;
    }
    
    #ov-toggle-btn:hover {
      background: var(--ov-bg-muted);
      padding-right: 10px;
    }
    
    body.ov-sidebar-open #ov-toggle-btn {
      right: ${SIDEBAR_WIDTH}px;
    }
    
    .ov-toggle-icon { font-size: 11px; color: var(--ov-text-secondary); }
    
    /* ====== TOAST ====== */
    .ov-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ov-bg-subtle);
      border: 1px solid var(--ov-border-default);
      color: var(--ov-text-primary);
      padding: 10px 20px;
      border-radius: var(--ov-radius-md);
      font-size: 12px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: var(--ov-shadow-lg);
      animation: ov-toast-in 0.2s ease;
    }
    
    @keyframes ov-toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(styles);
}

// ========== SIDEBAR CREATION ==========
function createSidebar() {
  if (document.getElementById('ov-sidebar')) return;
  
  const sidebar = document.createElement('div');
  sidebar.id = 'ov-sidebar';
  sidebar.className = 'hidden';
  
  const logoUrl = chrome.runtime.getURL('logo-ov.png');
  
  sidebar.innerHTML = `
    <div class="ov-header">
      <div class="ov-header-brand">
        <div class="ov-logo"><img src="${logoUrl}" alt="Logo" /></div>
        <div class="ov-brand-text">
          <div class="ov-brand-name">Origem Viva</div>
          <div class="ov-brand-label">CRM Dashboard</div>
        </div>
      </div>
      <button class="ov-close" onclick="toggleSidebar()">✕</button>
    </div>
    <div class="ov-content" id="ov-sidebar-content"></div>
  `;
  
  document.body.appendChild(sidebar);
}

function createToggleButton() {
  if (document.getElementById('ov-toggle-btn')) return;
  
  const btn = document.createElement('button');
  btn.id = 'ov-toggle-btn';
  btn.innerHTML = `<span class="ov-toggle-icon">◀</span>`;
  btn.onclick = toggleSidebar;
  document.body.appendChild(btn);
}

function toggleSidebar() {
  const sidebar = document.getElementById('ov-sidebar');
  if (!sidebar) return;
  
  if (sidebar.classList.contains('hidden')) {
    openSidebar();
  } else {
    closeSidebar();
  }
}

function openSidebar() {
  const sidebar = document.getElementById('ov-sidebar');
  sidebar.classList.remove('hidden');
  document.body.classList.add('ov-sidebar-open');
  sidebarVisible = true;
  
  const toggleBtn = document.getElementById('ov-toggle-btn');
  if (toggleBtn) toggleBtn.innerHTML = `<span class="ov-toggle-icon">▶</span>`;
  
  if (currentPhone) {
    loadLeadData(currentPhone);
  } else {
    renderContent();
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('ov-sidebar');
  sidebar.classList.add('hidden');
  document.body.classList.remove('ov-sidebar-open');
  sidebarVisible = false;
  
  const toggleBtn = document.getElementById('ov-toggle-btn');
  if (toggleBtn) toggleBtn.innerHTML = `<span class="ov-toggle-icon">◀</span>`;
}

window.toggleSidebar = toggleSidebar;

// ========== RENDERIZAÇÃO ==========
function renderContent() {
  const content = document.getElementById('ov-sidebar-content');
  renderLeadContent(content);
}

function renderLeadContent(container) {
  if (!currentPhone) {
    container.innerHTML = `
      <div class="ov-empty">
        <div class="ov-empty-icon">💬</div>
        <div class="ov-empty-title">Selecione uma conversa</div>
        <div class="ov-empty-text">Os dados do lead aparecerão aqui quando você abrir uma conversa</div>
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
  const customerName = customer?.name || transactions[0]?.customer_name || abandoned[0]?.customer_name || 'Lead';
  const initials = customerName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  
  let html = `
    <div class="ov-profile">
      <div class="ov-profile-main">
        <div class="ov-avatar">${initials || '?'}</div>
        <div class="ov-profile-info">
          <div class="ov-profile-name">${customerName}</div>
          <div class="ov-profile-phone">
            <span class="ov-phone-text">${displayPhone}</span>
            <button class="ov-copy-btn" data-copy="${currentPhone}" title="Copiar">📋</button>
          </div>
        </div>
      </div>
      <div class="ov-stats">
        <div class="ov-stat">
          <div class="ov-stat-value brand">${formatCurrency(totalPaid)}</div>
          <div class="ov-stat-label">Total Pago</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value warning">${formatCurrency(totalPending)}</div>
          <div class="ov-stat-label">Pendente</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value muted">${transactions.length}</div>
          <div class="ov-stat-label">Transações</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value danger">${abandoned.length}</div>
          <div class="ov-stat-label">Abandonos</div>
        </div>
      </div>
    </div>
  `;
  
  // Accordion Links Úteis
  if (usefulLinks.length > 0) {
    html += `
      <div class="ov-accordion">
        <button class="ov-accordion-header" id="ov-links-trigger">
          <div class="ov-accordion-left">
            <div class="ov-accordion-icon">🔗</div>
            <span class="ov-accordion-title">Links Úteis</span>
            <span class="ov-accordion-badge">${usefulLinks.length}</span>
          </div>
          <span class="ov-accordion-arrow">▼</span>
        </button>
        <div class="ov-accordion-body" id="ov-links-panel">
          <div class="ov-links-list">
            ${usefulLinks.map(link => `
              <div class="ov-link-row">
                <div class="ov-link-icon">🌐</div>
                <div class="ov-link-info">
                  <div class="ov-link-name">${link.title}</div>
                  ${link.description ? `<div class="ov-link-desc">${link.description}</div>` : ''}
                </div>
                <button class="ov-link-copy" data-copy="${link.url}">Copiar</button>
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
        <div class="ov-tx-list">
          ${transactions.map(tx => renderTransactionCard(tx)).join('')}
        </div>
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
        <div class="ov-tx-list">
          ${abandoned.map(ab => renderAbandonedCard(ab)).join('')}
        </div>
      </div>
    `;
  }
  
  // Empty
  if (transactions.length === 0 && abandoned.length === 0) {
    html += `
      <div class="ov-empty" style="padding: 32px 20px;">
        <div class="ov-empty-icon">📭</div>
        <div class="ov-empty-title">Sem histórico</div>
        <div class="ov-empty-text">Nenhuma transação ou evento encontrado</div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Events
  container.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(btn.dataset.copy);
    });
  });
  
  const accordionTrigger = container.querySelector('#ov-links-trigger');
  const accordionPanel = container.querySelector('#ov-links-panel');
  if (accordionTrigger && accordionPanel) {
    accordionTrigger.addEventListener('click', () => {
      accordionTrigger.classList.toggle('open');
      accordionPanel.classList.toggle('open');
    });
  }
}

function renderTransactionCard(tx) {
  const boletoUrl = tx.metadata?.boleto_url || tx.metadata?.boletoUrl;
  const barcode = tx.external_id;
  const isPending = ['gerado', 'pendente'].includes(tx.status);
  
  let html = `
    <div class="ov-tx ${tx.type}">
      <div class="ov-tx-row">
        <div class="ov-tx-info">
          <div class="ov-tx-product">${tx.description || tx.customer_name || 'Transação'}</div>
          <div class="ov-tx-meta">
            <span class="ov-badge ${tx.type}">${tx.type}</span>
            <span class="ov-badge ${tx.status}">${tx.status}</span>
            <span class="ov-tx-date">${formatDate(tx.created_at)}</span>
          </div>
        </div>
        <div class="ov-tx-amount ${isPending ? 'pending' : ''}">${formatCurrency(tx.amount)}</div>
      </div>
  `;
  
  if (barcode && isPending) {
    html += `
      <div class="ov-barcode">
        <div class="ov-barcode-label">Código de barras</div>
        <div class="ov-barcode-row">
          <div class="ov-barcode-value">${barcode}</div>
          <button class="ov-barcode-copy" data-copy="${barcode}">Copiar</button>
        </div>
      </div>
    `;
  }
  
  if (boletoUrl && isPending) {
    html += `
      <div class="ov-tx-actions">
        <button class="ov-action-btn" onclick="window.open('${boletoUrl}', '_blank')">
          📥 Ver Boleto
        </button>
      </div>
    `;
  }
  
  html += `</div>`;
  return html;
}

function renderAbandonedCard(ab) {
  return `
    <div class="ov-tx abandoned">
      <div class="ov-tx-row">
        <div class="ov-tx-info">
          <div class="ov-tx-product">${ab.product_name || ab.event_type || 'Abandono'}</div>
          <div class="ov-tx-meta">
            <span class="ov-badge abandoned">${ab.event_type || 'abandono'}</span>
            ${ab.funnel_stage ? `<span class="ov-badge" style="background: var(--ov-bg-muted); color: var(--ov-text-muted);">${ab.funnel_stage}</span>` : ''}
            <span class="ov-tx-date">${formatDate(ab.created_at)}</span>
          </div>
        </div>
        ${ab.amount ? `<div class="ov-tx-amount danger">${formatCurrency(ab.amount)}</div>` : ''}
      </div>
    </div>
  `;
}

// ========== UTILS ==========
function showToast(message) {
  const existing = document.querySelector('.ov-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'ov-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 2000);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast('Copiado!');
}

window.copyToClipboard = copyToClipboard;

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDisplayPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return `+${cleaned.slice(0,2)} ${cleaned.slice(2,4)} ${cleaned.slice(4,9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('55')) {
    return `+${cleaned.slice(0,2)} ${cleaned.slice(2,4)} ${cleaned.slice(4,8)}-${cleaned.slice(8)}`;
  }
  return phone;
}

// ========== API ==========
async function loadLeadData(phone) {
  console.log('[WhatsApp Extension] Carregando lead:', phone);
  
  const variations = generatePhoneVariations(phone);
  console.log('[WhatsApp Extension] Variações:', variations);
  
  const content = document.getElementById('ov-sidebar-content');
  if (content) {
    content.innerHTML = `
      <div class="ov-loading">
        <div class="ov-spinner"></div>
        <span class="ov-loading-text">Carregando...</span>
      </div>
    `;
  }
  
  try {
    const phoneParam = variations.join(',');
    const response = await fetch(`${API_URL}?action=lead&phone=${encodeURIComponent(phoneParam)}`);
    currentLeadData = await response.json();
    console.log('[WhatsApp Extension] Dados:', currentLeadData);
    renderContent();
  } catch (error) {
    console.error('[WhatsApp Extension] Erro:', error);
    if (content) {
      content.innerHTML = `
        <div class="ov-empty">
          <div class="ov-empty-icon">❌</div>
          <div class="ov-empty-title">Erro ao carregar</div>
        </div>
      `;
    }
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
  
  const conversationTitle = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
  if (conversationTitle) {
    const text = conversationTitle.textContent || '';
    const phone = extractPhoneFromText(text);
    if (phone) return phone;
  }
  
  const jidElements = document.querySelectorAll('[data-jid]');
  for (const el of jidElements) {
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
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) return match[0].replace(/^\+/, '');
  }
  return null;
}

function observeConversationChanges() {
  let lastConversationPhone = null;
  
  const checkConversation = () => {
    const phone = extractPhoneFromConversation();
    
    if (phone && phone !== lastConversationPhone) {
      console.log('[WhatsApp Extension] Conversa:', phone);
      lastConversationPhone = phone;
      currentPhone = phone;
      
      if (sidebarVisible) {
        loadLeadData(phone);
      }
    }
  };
  
  setInterval(checkConversation, 1000);
  
  const observer = new MutationObserver(() => {
    setTimeout(checkConversation, 200);
  });
  
  const waitForApp = setInterval(() => {
    const app = document.querySelector('#app, [data-testid="chat-list"]');
    if (app) {
      clearInterval(waitForApp);
      observer.observe(document.body, { childList: true, subtree: true });
      checkConversation();
    }
  }, 500);
}

// ========== OPEN CHAT FUNCTION ==========
function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  
  // Se já começa com 55, retorna como está
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned;
  }
  
  // Se tem 10 ou 11 dígitos (DDD + número), adiciona 55
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return '55' + cleaned;
  }
  
  return cleaned;
}

async function openChat(phone) {
  const formatted = formatPhoneForWhatsApp(phone);
  console.log('[WhatsApp Extension] Abrindo chat:', formatted);
  
  try {
    await new Promise(r => setTimeout(r, 300));
    
    // Procura botão nova conversa
    const newChatSelectors = [
      '[data-testid="menu-bar-new-chat"]',
      'span[data-icon="new-chat"]',
      'span[data-icon="new-chat-outline"]',
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
      console.error('[WhatsApp Extension] Botão nova conversa não encontrado');
      return false;
    }
    
    simulateRealClick(newChatBtn);
    await new Promise(r => setTimeout(r, 1000));
    
    // Procura campo de busca
    let searchInput = null;
    const searchSelectors = [
      '[data-testid="chat-list-search"]',
      'div[contenteditable="true"][data-tab="3"]',
      'div[contenteditable="true"][role="textbox"]',
      'p.selectable-text[data-tab="3"]'
    ];
    
    for (const sel of searchSelectors) {
      searchInput = document.querySelector(sel);
      if (searchInput) break;
    }
    
    if (!searchInput) {
      const panel = document.querySelector('[data-testid="chat-list"]') || document.querySelector('#pane-side');
      if (panel) {
        searchInput = panel.querySelector('div[contenteditable="true"]') || panel.querySelector('p[contenteditable="true"]');
      }
    }
    
    if (!searchInput) {
      console.error('[WhatsApp Extension] Campo busca não encontrado');
      return false;
    }
    
    console.log('[WhatsApp Extension] Digitando:', formatted);
    searchInput.focus();
    await new Promise(r => setTimeout(r, 200));
    
    searchInput.textContent = '';
    document.execCommand('insertText', false, formatted);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Procura contato na lista
    const searchPanel = document.querySelector('[data-testid="chat-list"]') || 
                        document.querySelector('#pane-side') ||
                        document.querySelector('[aria-label="Lista de conversas"]');
    
    if (!searchPanel) {
      console.error('[WhatsApp Extension] Painel não encontrado');
      return false;
    }
    
    // Procura por elemento clicável com o número
    const lastDigits = formatted.slice(-8);
    let contactItem = null;
    
    // Tenta seletores específicos primeiro
    const cellFrames = searchPanel.querySelectorAll('div[data-testid="cell-frame-container"], div[tabindex="-1"]');
    for (const cell of cellFrames) {
      const text = cell.textContent || '';
      if (text.includes(formatted) || text.includes(lastDigits)) {
        contactItem = cell;
        break;
      }
    }
    
    // Fallback: primeiro resultado
    if (!contactItem) {
      contactItem = searchPanel.querySelector('div[data-testid="cell-frame-container"]') ||
                    searchPanel.querySelector('div[tabindex="-1"]');
    }
    
    if (contactItem) {
      console.log('[WhatsApp Extension] Clicando contato...');
      simulateRealClick(contactItem);
      await new Promise(r => setTimeout(r, 500));
      return true;
    }
    
    console.error('[WhatsApp Extension] Contato não encontrado');
    return false;
    
  } catch (error) {
    console.error('[WhatsApp Extension] Erro:', error);
    return false;
  }
}

function simulateRealClick(element) {
  if (!element) return;
  
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  ['mousedown', 'mouseup', 'click'].forEach(eventType => {
    element.dispatchEvent(new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0
    }));
  });
}

function insertTextWithLineBreaks(element, text) {
  element.focus();
  element.textContent = '';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    document.execCommand('insertText', false, lines[i]);
    if (i < lines.length - 1) document.execCommand('insertLineBreak');
  }
  element.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

async function sendTextMessage(text) {
  try {
    const input = document.querySelector('[data-testid="conversation-compose-box-input"], footer [contenteditable="true"]');
    if (!input) return false;
    insertTextWithLineBreaks(input, text);
    await new Promise(r => setTimeout(r, 300));
    return true;
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao enviar:', error);
    return false;
  }
}

// ========== MESSAGE LISTENER ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[WhatsApp Extension] Mensagem:', request);
  
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
  
  sendResponse({ success: false, error: 'Ação desconhecida' });
  return true;
});

// ========== INIT ==========
function init() {
  console.log('[WhatsApp Extension] Inicializando...');
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
