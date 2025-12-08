// Content Script - WhatsApp Web
// Executa ações na interface do WhatsApp + Mini Dashboard Corporativo

console.log('[WhatsApp Extension] Content script carregado');

// ========== CONFIGURAÇÃO ==========
const API_URL = 'https://suaznqybxvborpkrtdpm.supabase.co/functions/v1/whatsapp-dashboard';
const SIDEBAR_WIDTH = 380;

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
  
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  if (digits.length === 11) {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  return digits;
}

function generatePhoneVariations(phone) {
  if (!phone) return [];
  
  let originalDigits = phone.replace(/\D/g, '');
  if (originalDigits.length < 8) return [];
  
  const variations = new Set();
  variations.add(originalDigits);
  
  let withoutCountry = originalDigits;
  if (originalDigits.startsWith('55') && originalDigits.length >= 12) {
    withoutCountry = originalDigits.slice(2);
    variations.add(withoutCountry);
  }
  
  let base = withoutCountry;
  if (base.length === 11 && base[2] === '9') {
    base = base.slice(0, 2) + base.slice(3);
  } else if (base.length === 11) {
    base = base.slice(0, 2) + base.slice(3);
  }
  
  if (base.length === 10) {
    const ddd = base.slice(0, 2);
    const number = base.slice(2);
    const with9 = ddd + '9' + number;
    
    variations.add(base);
    variations.add(with9);
    variations.add('55' + base);
    variations.add('55' + with9);
  } else if (base.length === 9) {
    variations.add(base);
    variations.add('55' + base);
  }
  
  if (!originalDigits.startsWith('55') && originalDigits.length <= 11) {
    variations.add('55' + originalDigits);
  }
  
  return Array.from(variations);
}

// ========== ESTILOS CSS CORPORATIVO PREMIUM ==========
function injectStyles() {
  if (document.getElementById('ov-dashboard-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'ov-dashboard-styles';
  styles.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    :root {
      --ov-bg-primary: #0c1117;
      --ov-bg-secondary: #141b24;
      --ov-bg-tertiary: #1a232e;
      --ov-bg-card: rgba(20, 27, 36, 0.8);
      --ov-border: rgba(255, 255, 255, 0.06);
      --ov-border-accent: rgba(34, 197, 94, 0.3);
      --ov-text-primary: #f1f5f9;
      --ov-text-secondary: #94a3b8;
      --ov-text-muted: #64748b;
      --ov-accent: #22c55e;
      --ov-accent-glow: rgba(34, 197, 94, 0.15);
      --ov-warning: #f59e0b;
      --ov-danger: #ef4444;
      --ov-info: #3b82f6;
    }
    
    body.ov-sidebar-open #app {
      width: calc(100% - ${SIDEBAR_WIDTH}px) !important;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    #ov-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: ${SIDEBAR_WIDTH}px;
      height: 100vh;
      background: var(--ov-bg-primary);
      border-left: 1px solid var(--ov-border);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: -20px 0 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    
    #ov-sidebar.hidden {
      transform: translateX(100%);
    }
    
    #ov-sidebar * {
      box-sizing: border-box;
    }
    
    /* ===== HEADER PREMIUM ===== */
    #ov-sidebar-header {
      padding: 20px 24px;
      background: linear-gradient(180deg, var(--ov-bg-secondary) 0%, var(--ov-bg-primary) 100%);
      border-bottom: 1px solid var(--ov-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    
    .ov-header-left {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }
    
    .ov-logo-container {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      background: var(--ov-accent-glow);
      border: 1px solid var(--ov-border-accent);
    }
    
    .ov-logo-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .ov-header-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .ov-header-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--ov-text-primary);
      letter-spacing: -0.3px;
    }
    
    .ov-header-subtitle {
      font-size: 11px;
      color: var(--ov-text-muted);
      font-weight: 400;
    }
    
    .ov-close-btn {
      background: var(--ov-bg-tertiary);
      border: 1px solid var(--ov-border);
      color: var(--ov-text-muted);
      cursor: pointer;
      padding: 0;
      font-size: 14px;
      line-height: 1;
      border-radius: 8px;
      transition: all 0.2s;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .ov-close-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.3);
      color: var(--ov-danger);
    }
    
    /* ===== LEAD PROFILE CARD ===== */
    .ov-profile-section {
      padding: 20px 24px;
      background: var(--ov-bg-secondary);
      border-bottom: 1px solid var(--ov-border);
    }
    
    .ov-profile-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    
    .ov-profile-avatar {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, var(--ov-accent) 0%, #16a34a 100%);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      flex-shrink: 0;
      box-shadow: 0 8px 24px rgba(34, 197, 94, 0.25);
    }
    
    .ov-profile-info {
      flex: 1;
      min-width: 0;
    }
    
    .ov-profile-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--ov-text-primary);
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-profile-phone {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .ov-profile-phone-text {
      font-size: 13px;
      color: var(--ov-text-secondary);
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    }
    
    .ov-copy-btn {
      background: none;
      border: none;
      color: var(--ov-text-muted);
      cursor: pointer;
      padding: 4px;
      font-size: 12px;
      opacity: 0.6;
      transition: all 0.2s;
    }
    
    .ov-copy-btn:hover {
      opacity: 1;
      color: var(--ov-accent);
    }
    
    /* ===== STATS GRID ===== */
    .ov-stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    
    .ov-stat-card {
      background: var(--ov-bg-primary);
      border: 1px solid var(--ov-border);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      transition: all 0.2s;
    }
    
    .ov-stat-card:hover {
      border-color: var(--ov-border-accent);
      background: var(--ov-accent-glow);
    }
    
    .ov-stat-value {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }
    
    .ov-stat-value.success { color: var(--ov-accent); }
    .ov-stat-value.warning { color: var(--ov-warning); }
    .ov-stat-value.danger { color: var(--ov-danger); }
    .ov-stat-value.muted { color: var(--ov-text-muted); }
    
    .ov-stat-label {
      font-size: 10px;
      color: var(--ov-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 500;
    }
    
    /* ===== CONTENT AREA ===== */
    #ov-sidebar-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px 24px;
      background: var(--ov-bg-primary);
    }
    
    #ov-sidebar-content::-webkit-scrollbar {
      width: 6px;
    }
    
    #ov-sidebar-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    #ov-sidebar-content::-webkit-scrollbar-thumb {
      background: var(--ov-bg-tertiary);
      border-radius: 3px;
    }
    
    #ov-sidebar-content::-webkit-scrollbar-thumb:hover {
      background: var(--ov-text-muted);
    }
    
    /* ===== ACCORDION (LINKS ÚTEIS) ===== */
    .ov-accordion {
      margin-bottom: 24px;
    }
    
    .ov-accordion-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px;
      background: linear-gradient(135deg, var(--ov-bg-secondary) 0%, var(--ov-bg-tertiary) 100%);
      border: 1px solid var(--ov-border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .ov-accordion-trigger:hover {
      border-color: rgba(59, 130, 246, 0.3);
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, var(--ov-bg-tertiary) 100%);
    }
    
    .ov-accordion-trigger.open {
      border-radius: 12px 12px 0 0;
      border-bottom-color: transparent;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, var(--ov-bg-tertiary) 100%);
    }
    
    .ov-accordion-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .ov-accordion-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    
    .ov-accordion-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--ov-text-primary);
    }
    
    .ov-accordion-count {
      font-size: 11px;
      color: var(--ov-info);
      background: rgba(59, 130, 246, 0.1);
      padding: 3px 10px;
      border-radius: 20px;
      font-weight: 500;
    }
    
    .ov-accordion-arrow {
      font-size: 12px;
      color: var(--ov-text-muted);
      transition: transform 0.2s;
    }
    
    .ov-accordion-trigger.open .ov-accordion-arrow {
      transform: rotate(180deg);
    }
    
    .ov-accordion-panel {
      display: none;
      padding: 16px;
      background: var(--ov-bg-secondary);
      border: 1px solid var(--ov-border);
      border-top: none;
      border-radius: 0 0 12px 12px;
    }
    
    .ov-accordion-panel.open {
      display: block;
    }
    
    .ov-links-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .ov-link-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: var(--ov-bg-primary);
      border: 1px solid var(--ov-border);
      border-radius: 10px;
      transition: all 0.2s;
    }
    
    .ov-link-item:hover {
      border-color: rgba(59, 130, 246, 0.3);
      background: rgba(59, 130, 246, 0.05);
    }
    
    .ov-link-icon-box {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.04) 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    
    .ov-link-content {
      flex: 1;
      min-width: 0;
    }
    
    .ov-link-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--ov-text-primary);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-link-desc {
      font-size: 11px;
      color: var(--ov-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-link-copy {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 8px;
      padding: 10px 16px;
      color: var(--ov-info);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
      font-family: inherit;
    }
    
    .ov-link-copy:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.4);
    }
    
    /* ===== SECTION HEADER ===== */
    .ov-section {
      margin-bottom: 24px;
    }
    
    .ov-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--ov-border);
    }
    
    .ov-section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--ov-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .ov-section-count {
      font-size: 11px;
      color: var(--ov-text-muted);
      background: var(--ov-bg-tertiary);
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    /* ===== TRANSACTION CARDS ===== */
    .ov-tx-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .ov-tx-card {
      background: var(--ov-bg-secondary);
      border: 1px solid var(--ov-border);
      border-radius: 14px;
      padding: 16px 18px;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }
    
    .ov-tx-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
    }
    
    .ov-tx-card.boleto::before { background: var(--ov-warning); }
    .ov-tx-card.pix::before { background: var(--ov-accent); }
    .ov-tx-card.cartao::before { background: #8b5cf6; }
    .ov-tx-card.abandoned::before { background: var(--ov-danger); }
    
    .ov-tx-card:hover {
      border-color: var(--ov-border-accent);
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    
    .ov-tx-main {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .ov-tx-info {
      flex: 1;
      min-width: 0;
    }
    
    .ov-tx-product {
      font-size: 14px;
      font-weight: 600;
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
    
    .ov-tx-badge {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    
    .ov-tx-badge.boleto { background: rgba(245, 158, 11, 0.12); color: var(--ov-warning); }
    .ov-tx-badge.pix { background: rgba(34, 197, 94, 0.12); color: var(--ov-accent); }
    .ov-tx-badge.cartao { background: rgba(139, 92, 246, 0.12); color: #a78bfa; }
    .ov-tx-badge.gerado { background: rgba(245, 158, 11, 0.12); color: var(--ov-warning); }
    .ov-tx-badge.pendente { background: rgba(245, 158, 11, 0.12); color: var(--ov-warning); }
    .ov-tx-badge.pago { background: rgba(34, 197, 94, 0.12); color: var(--ov-accent); }
    .ov-tx-badge.cancelado { background: rgba(239, 68, 68, 0.12); color: var(--ov-danger); }
    .ov-tx-badge.expirado { background: rgba(100, 116, 139, 0.12); color: var(--ov-text-muted); }
    
    .ov-tx-date {
      font-size: 11px;
      color: var(--ov-text-muted);
    }
    
    .ov-tx-amount {
      font-size: 18px;
      font-weight: 700;
      color: var(--ov-accent);
      flex-shrink: 0;
      letter-spacing: -0.5px;
    }
    
    .ov-tx-amount.pending {
      color: var(--ov-warning);
    }
    
    .ov-tx-amount.danger {
      color: var(--ov-danger);
    }
    
    /* Barcode Box */
    .ov-barcode-section {
      background: var(--ov-bg-primary);
      border: 1px solid var(--ov-border);
      border-radius: 10px;
      padding: 12px 14px;
      margin-top: 12px;
    }
    
    .ov-barcode-label {
      font-size: 9px;
      color: var(--ov-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      font-weight: 500;
    }
    
    .ov-barcode-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .ov-barcode-value {
      flex: 1;
      font-size: 11px;
      color: var(--ov-text-secondary);
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-barcode-copy {
      background: var(--ov-accent-glow);
      border: 1px solid var(--ov-border-accent);
      border-radius: 6px;
      padding: 6px 12px;
      color: var(--ov-accent);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      flex-shrink: 0;
    }
    
    .ov-barcode-copy:hover {
      background: rgba(34, 197, 94, 0.2);
    }
    
    /* Boleto Action */
    .ov-tx-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    .ov-tx-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 14px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 8px;
      color: var(--ov-info);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    
    .ov-tx-action-btn:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.4);
    }
    
    /* ===== EMPTY STATE ===== */
    .ov-empty-state {
      text-align: center;
      padding: 48px 24px;
    }
    
    .ov-empty-icon {
      width: 72px;
      height: 72px;
      background: var(--ov-bg-secondary);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 32px;
    }
    
    .ov-empty-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--ov-text-primary);
      margin-bottom: 8px;
    }
    
    .ov-empty-text {
      font-size: 13px;
      color: var(--ov-text-muted);
      line-height: 1.6;
      max-width: 280px;
      margin: 0 auto;
    }
    
    /* ===== TOGGLE BUTTON ===== */
    .ov-toggle-btn {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      width: 32px;
      height: 80px;
      background: linear-gradient(180deg, var(--ov-accent) 0%, #16a34a 100%);
      border: none;
      border-radius: 10px 0 0 10px;
      cursor: pointer;
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: -4px 0 24px rgba(34, 197, 94, 0.3);
    }
    
    .ov-toggle-btn:hover {
      width: 40px;
    }
    
    .ov-toggle-btn-icon {
      font-size: 14px;
      color: white;
    }
    
    body.ov-sidebar-open .ov-toggle-btn {
      right: ${SIDEBAR_WIDTH}px;
    }
    
    /* ===== LOADING ===== */
    .ov-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 24px;
      color: var(--ov-text-muted);
      gap: 16px;
    }
    
    .ov-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid var(--ov-bg-tertiary);
      border-top-color: var(--ov-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* ===== TOAST ===== */
    .ov-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, var(--ov-accent) 0%, #16a34a 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      z-index: 100001;
      animation: toastIn 0.25s ease;
      box-shadow: 0 10px 40px rgba(34, 197, 94, 0.35);
    }
    
    @keyframes toastIn {
      from { opacity: 0; transform: translate(-50%, 20px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
  `;
  document.head.appendChild(styles);
}

// ========== COMPONENTES UI ==========
function createSidebar() {
  if (document.getElementById('ov-sidebar')) return;
  
  const sidebar = document.createElement('div');
  sidebar.id = 'ov-sidebar';
  sidebar.className = 'hidden';
  sidebar.innerHTML = `
    <div id="ov-sidebar-header">
      <div class="ov-header-left">
        <div class="ov-logo-container"><img src="${chrome.runtime.getURL('logo-ov.png')}" alt="OV"></div>
        <div class="ov-header-info">
          <div class="ov-header-title">Origem Viva</div>
          <div class="ov-header-subtitle">Histórico do Lead</div>
        </div>
      </div>
      <button class="ov-close-btn" id="ov-close-sidebar">✕</button>
    </div>
    <div id="ov-sidebar-content">
      <div class="ov-loading"><div class="ov-spinner"></div><span>Carregando...</span></div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  document.getElementById('ov-close-sidebar').addEventListener('click', closeSidebar);
}

function createToggleButton() {
  if (document.getElementById('ov-toggle-btn')) return;
  
  const btn = document.createElement('button');
  btn.id = 'ov-toggle-btn';
  btn.className = 'ov-toggle-btn';
  btn.innerHTML = `<span class="ov-toggle-btn-icon">◀</span>`;
  btn.onclick = toggleSidebar;
  document.body.appendChild(btn);
}

function toggleSidebar() {
  const sidebar = document.getElementById('ov-sidebar');
  
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
  if (toggleBtn) toggleBtn.innerHTML = `<span class="ov-toggle-btn-icon">▶</span>`;
  
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
  if (toggleBtn) toggleBtn.innerHTML = `<span class="ov-toggle-btn-icon">◀</span>`;
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
      <div class="ov-empty-state">
        <div class="ov-empty-icon">💬</div>
        <div class="ov-empty-title">Selecione uma conversa</div>
        <div class="ov-empty-text">Os dados do lead aparecerão aqui quando você abrir uma conversa no WhatsApp</div>
      </div>
    `;
    return;
  }
  
  if (!currentLeadData) {
    container.innerHTML = `<div class="ov-loading"><div class="ov-spinner"></div><span>Carregando lead...</span></div>`;
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
  
  // Build HTML
  let html = `
    <div class="ov-profile-section">
      <div class="ov-profile-header">
        <div class="ov-profile-avatar">${initials || '?'}</div>
        <div class="ov-profile-info">
          <div class="ov-profile-name">${customerName}</div>
          <div class="ov-profile-phone">
            <span class="ov-profile-phone-text">${displayPhone}</span>
            <button class="ov-copy-btn" data-copy="${currentPhone}" title="Copiar">📋</button>
          </div>
        </div>
      </div>
      <div class="ov-stats-grid">
        <div class="ov-stat-card">
          <div class="ov-stat-value success">${formatCurrency(totalPaid)}</div>
          <div class="ov-stat-label">Total Pago</div>
        </div>
        <div class="ov-stat-card">
          <div class="ov-stat-value warning">${formatCurrency(totalPending)}</div>
          <div class="ov-stat-label">Pendente</div>
        </div>
        <div class="ov-stat-card">
          <div class="ov-stat-value muted">${transactions.length}</div>
          <div class="ov-stat-label">Transações</div>
        </div>
        <div class="ov-stat-card">
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
        <button class="ov-accordion-trigger" id="ov-links-trigger">
          <div class="ov-accordion-left">
            <div class="ov-accordion-icon">🔗</div>
            <span class="ov-accordion-label">Links Úteis</span>
            <span class="ov-accordion-count">${usefulLinks.length}</span>
          </div>
          <span class="ov-accordion-arrow">▼</span>
        </button>
        <div class="ov-accordion-panel" id="ov-links-panel">
          <div class="ov-links-grid">
            ${usefulLinks.map(link => `
              <div class="ov-link-item">
                <div class="ov-link-icon-box">🌐</div>
                <div class="ov-link-content">
                  <div class="ov-link-title">${link.title}</div>
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
  
  // Transactions Section
  if (transactions.length > 0) {
    html += `
      <div class="ov-section">
        <div class="ov-section-header">
          <span class="ov-section-title">📋 Histórico de Transações</span>
          <span class="ov-section-count">${transactions.length}</span>
        </div>
        <div class="ov-tx-list">
          ${transactions.map(tx => renderTransactionCard(tx)).join('')}
        </div>
      </div>
    `;
  }
  
  // Abandoned Section
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
  
  // Empty state
  if (transactions.length === 0 && abandoned.length === 0) {
    html += `
      <div class="ov-empty-state" style="padding: 32px 24px;">
        <div class="ov-empty-icon" style="width: 56px; height: 56px; font-size: 24px;">📭</div>
        <div class="ov-empty-title">Sem histórico</div>
        <div class="ov-empty-text">Nenhuma transação ou evento encontrado para este lead</div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Event listeners
  container.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(btn.dataset.copy);
    });
  });
  
  // Accordion toggle
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
  const customerName = tx.customer_name || 'Transação';
  const isPending = ['gerado', 'pendente'].includes(tx.status);
  const isPaid = tx.status === 'pago';
  
  let html = `
    <div class="ov-tx-card ${tx.type}">
      <div class="ov-tx-main">
        <div class="ov-tx-info">
          <div class="ov-tx-product">${tx.description || customerName}</div>
          <div class="ov-tx-meta">
            <span class="ov-tx-badge ${tx.type}">${tx.type}</span>
            <span class="ov-tx-badge ${tx.status}">${tx.status}</span>
            <span class="ov-tx-date">${formatDate(tx.created_at)}</span>
          </div>
        </div>
        <div class="ov-tx-amount ${isPending ? 'pending' : ''}">${formatCurrency(tx.amount)}</div>
      </div>
  `;
  
  if (barcode && isPending) {
    html += `
      <div class="ov-barcode-section">
        <div class="ov-barcode-label">Código de Barras</div>
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
        <button class="ov-tx-action-btn" onclick="window.open('${boletoUrl}', '_blank')">
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
    <div class="ov-tx-card abandoned">
      <div class="ov-tx-main">
        <div class="ov-tx-info">
          <div class="ov-tx-product">${ab.product_name || ab.event_type || 'Abandono'}</div>
          <div class="ov-tx-meta">
            <span class="ov-tx-badge" style="background: rgba(239, 68, 68, 0.12); color: var(--ov-danger);">${ab.event_type || 'abandono'}</span>
            ${ab.funnel_stage ? `<span class="ov-tx-badge" style="background: rgba(100, 116, 139, 0.12); color: var(--ov-text-muted);">${ab.funnel_stage}</span>` : ''}
            <span class="ov-tx-date">${formatDate(ab.created_at)}</span>
          </div>
        </div>
        ${ab.amount ? `<div class="ov-tx-amount danger">${formatCurrency(ab.amount)}</div>` : ''}
      </div>
    </div>
  `;
}

// ========== UTILIDADES ==========
function showToast(message) {
  const existing = document.querySelector('.ov-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'ov-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 2500);
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
  console.log('[WhatsApp Extension] Carregando dados do lead:', phone);
  
  const variations = generatePhoneVariations(phone);
  console.log('[WhatsApp Extension] Variações do telefone:', variations);
  
  const content = document.getElementById('ov-sidebar-content');
  if (content) {
    content.innerHTML = `<div class="ov-loading"><div class="ov-spinner"></div><span>Carregando lead...</span></div>`;
  }
  
  try {
    const phoneParam = variations.join(',');
    const response = await fetch(`${API_URL}?action=lead&phone=${encodeURIComponent(phoneParam)}`);
    currentLeadData = await response.json();
    
    console.log('[WhatsApp Extension] Dados recebidos:', currentLeadData);
    
    renderContent();
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao carregar lead:', error);
    if (content) {
      content.innerHTML = `<div class="ov-empty-state"><div class="ov-empty-title">Erro ao carregar</div></div>`;
    }
  }
}

// ========== DETECÇÃO DE CONVERSA ==========
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
  
  const urlMatch = window.location.href.match(/phone=(\d+)/);
  if (urlMatch) return urlMatch[1];
  
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
      console.log('[WhatsApp Extension] Conversa mudou para:', phone);
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

// ========== FUNÇÕES PARA COMANDOS DO BACKGROUND ==========
function waitForElement(selector, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const element = document.querySelector(selector);
      if (element) { resolve(element); return; }
      if (Date.now() - startTime > timeout) { reject(new Error(`Timeout: ${selector}`)); return; }
      requestAnimationFrame(check);
    };
    check();
  });
}

function formatPhone(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

function simulateTyping(el, text) {
  el.focus();
  el.textContent = '';
  document.execCommand('insertText', false, text);
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
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

async function openChat(phone) {
  const formatted = formatPhone(phone);
  console.log('[WhatsApp Extension] Abrindo chat para:', formatted);
  
  try {
    await new Promise(r => setTimeout(r, 300));
    
    // Procura pelo botão de nova conversa usando múltiplos seletores
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
      console.error('[WhatsApp Extension] Botão Nova Conversa não encontrado');
      return false;
    }
    
    console.log('[WhatsApp Extension] Clicando em Nova Conversa...');
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
    
    // Fallback: qualquer contenteditable no painel lateral
    if (!searchInput) {
      const panel = document.querySelector('[data-testid="chat-list"]') || document.querySelector('#pane-side');
      if (panel) {
        searchInput = panel.querySelector('div[contenteditable="true"]') || 
                      panel.querySelector('p[contenteditable="true"]');
      }
    }
    
    if (!searchInput) {
      console.error('[WhatsApp Extension] Campo de busca não encontrado');
      return false;
    }
    
    console.log('[WhatsApp Extension] Digitando número:', formatted);
    searchInput.focus();
    await new Promise(r => setTimeout(r, 200));
    
    // Limpa e digita usando múltiplas técnicas
    searchInput.textContent = '';
    
    // Tenta insertText
    if (document.execCommand) {
      document.execCommand('insertText', false, formatted);
    } else {
      searchInput.textContent = formatted;
    }
    
    // Dispara eventos necessários
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: formatted }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Aguarda resultados
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('[WhatsApp Extension] Procurando contato na lista...');
    
    // Encontra o painel de resultados de busca
    const searchPanel = document.querySelector('[data-testid="chat-list"]') || 
                        document.querySelector('#pane-side') ||
                        document.querySelector('[aria-label="Lista de conversas"]');
    
    if (!searchPanel) {
      console.error('[WhatsApp Extension] Painel de busca não encontrado');
      return false;
    }
    
    // Procura todos os elementos clicáveis que parecem ser itens de lista
    const allDivs = searchPanel.querySelectorAll('div');
    let contactItem = null;
    const lastDigits = formatted.slice(-8);
    
    for (const div of allDivs) {
      // Verifica se é um item de lista com o número
      const text = div.textContent || '';
      const hasRole = div.getAttribute('role') === 'listitem' || 
                      div.getAttribute('role') === 'option' ||
                      div.getAttribute('role') === 'row' ||
                      div.getAttribute('role') === 'button';
      const hasTabindex = div.getAttribute('tabindex') !== null;
      
      // Verifica se contém o número e parece ser um item clicável
      if ((text.includes(formatted) || text.includes(lastDigits)) && (hasRole || hasTabindex)) {
        // Prefere o elemento mais específico (menor)
        if (!contactItem || div.textContent.length < contactItem.textContent.length) {
          contactItem = div;
        }
      }
    }
    
    // Se não encontrou por role, procura por estrutura visual
    if (!contactItem) {
      // Procura elementos que parecem ser cards de contato (têm imagem + texto)
      const potentialItems = searchPanel.querySelectorAll('div[tabindex="-1"], div[data-testid="cell-frame-container"]');
      for (const item of potentialItems) {
        const text = item.textContent || '';
        if (text.includes(formatted) || text.includes(lastDigits)) {
          contactItem = item;
          console.log('[WhatsApp Extension] Contato encontrado por estrutura');
          break;
        }
      }
    }
    
    // Último recurso: pega o primeiro item da lista que parece ser um contato
    if (!contactItem) {
      await new Promise(r => setTimeout(r, 500));
      
      // Procura o primeiro elemento com tabindex ou role de listitem
      const firstResult = searchPanel.querySelector('div[tabindex="-1"]') ||
                          searchPanel.querySelector('[role="listitem"]') ||
                          searchPanel.querySelector('[role="option"]');
      
      if (firstResult && firstResult.textContent.length > 5) {
        contactItem = firstResult;
        console.log('[WhatsApp Extension] Usando primeiro resultado');
      }
    }
    
    if (contactItem) {
      console.log('[WhatsApp Extension] Clicando no contato encontrado...');
      
      // Simula clique real com eventos de mouse
      simulateRealClick(contactItem);
      await new Promise(r => setTimeout(r, 500));
      
      // Verifica se abriu
      const chatOpened = document.querySelector('[data-testid="conversation-panel-wrapper"]') ||
                         document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                         document.querySelector('footer div[contenteditable="true"]');
      
      if (chatOpened) {
        console.log('[WhatsApp Extension] Conversa aberta com sucesso!');
        return true;
      }
      
      // Tenta clicar em subelementos
      const clickTargets = [
        contactItem.querySelector('span'),
        contactItem.querySelector('div[role="button"]'),
        contactItem.firstElementChild
      ];
      
      for (const target of clickTargets) {
        if (target) {
          simulateRealClick(target);
          await new Promise(r => setTimeout(r, 300));
          
          const opened = document.querySelector('[data-testid="conversation-compose-box-input"]');
          if (opened) {
            console.log('[WhatsApp Extension] Conversa aberta após retry!');
            return true;
          }
        }
      }
      
      return true;
    }
    
    console.error('[WhatsApp Extension] Nenhum contato encontrado na lista');
    return false;
    
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao abrir chat:', error);
    return false;
  }
}

// Simula um clique real com eventos de mouse completos
function simulateRealClick(element) {
  if (!element) return;
  
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  const mouseEvents = ['mousedown', 'mouseup', 'click'];
  
  for (const eventType of mouseEvents) {
    const event = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0
    });
    element.dispatchEvent(event);
  }
}

async function sendTextMessage(text) {
  try {
    const input = await waitForElement('[data-testid="conversation-compose-box-input"], footer [contenteditable="true"]', 2000);
    insertTextWithLineBreaks(input, text);
    await new Promise(r => setTimeout(r, 300));
    return true;
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao inserir texto:', error);
    return false;
  }
}

// ========== LISTENER DE MENSAGENS ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[WhatsApp Extension] Mensagem recebida:', request);
  
  if (request.type === 'PING') {
    sendResponse({ status: 'ok', location: window.location.href });
    return true;
  }
  
  if (request.type === 'OPEN_CHAT') {
    openChat(request.phone).then(success => {
      sendResponse({ success });
    });
    return true;
  }
  
  if (request.type === 'SEND_TEXT') {
    sendTextMessage(request.text).then(success => {
      sendResponse({ success });
    });
    return true;
  }
  
  sendResponse({ success: false, error: 'Ação desconhecida' });
  return true;
});

// ========== INICIALIZAÇÃO ==========
function init() {
  console.log('[WhatsApp Extension] Inicializando dashboard...');
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
