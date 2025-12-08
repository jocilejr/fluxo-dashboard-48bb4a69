// Content Script - WhatsApp Web
// Executa ações na interface do WhatsApp + Mini Dashboard Refinado

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
  
  // Remove country code 55 if present
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  // Remove 9th digit if present (Brazilian mobile)
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  // Also handle case where we have 11 digits but 3rd digit is NOT 9 (landline with leading 0 or other)
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
  
  // Add original
  variations.add(originalDigits);
  
  // Work with digits without country code
  let withoutCountry = originalDigits;
  if (originalDigits.startsWith('55') && originalDigits.length >= 12) {
    withoutCountry = originalDigits.slice(2);
    variations.add(withoutCountry);
  }
  
  // Generate base form (DDD + 8 digits without 9th digit)
  let base = withoutCountry;
  if (base.length === 11 && base[2] === '9') {
    base = base.slice(0, 2) + base.slice(3); // Remove 9th digit
  } else if (base.length === 11) {
    base = base.slice(0, 2) + base.slice(3); // Force 10 digits
  }
  
  if (base.length === 10) {
    const ddd = base.slice(0, 2);
    const number = base.slice(2);
    const with9 = ddd + '9' + number;
    
    // All variations
    variations.add(base);           // 4181503356
    variations.add(with9);          // 41981503356
    variations.add('55' + base);    // 554181503356
    variations.add('55' + with9);   // 5541981503356
  } else if (base.length === 9) {
    // Missing DDD digit - try adding common patterns
    variations.add(base);
    variations.add('55' + base);
  }
  
  // Also handle if input was already with country code
  if (!originalDigits.startsWith('55') && originalDigits.length <= 11) {
    variations.add('55' + originalDigits);
  }
  
  return Array.from(variations);
}

// ========== ESTILOS CSS ==========
function injectStyles() {
  if (document.getElementById('ov-dashboard-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'ov-dashboard-styles';
  styles.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    /* Ajusta o WhatsApp para dar espaço à sidebar */
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
      background: linear-gradient(180deg, #0a0f14 0%, #0d1318 100%);
      border-left: 1px solid rgba(34, 197, 94, 0.2);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', -apple-system, sans-serif;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    
    #ov-sidebar.hidden {
      transform: translateX(100%);
    }
    
    #ov-sidebar * {
      box-sizing: border-box;
    }
    
    #ov-sidebar-header {
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, transparent 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    
    .ov-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    
    .ov-logo-container {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
      flex-shrink: 0;
      overflow: hidden;
    }
    
    .ov-logo-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .ov-header-title {
      font-size: 14px;
      font-weight: 600;
      color: #f8fafc;
      letter-spacing: -0.3px;
    }
    
    .ov-header-subtitle {
      font-size: 10px;
      color: rgba(148, 163, 184, 0.8);
      margin-top: 1px;
    }
    
    .ov-close-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      cursor: pointer;
      padding: 0;
      font-size: 16px;
      line-height: 1;
      border-radius: 6px;
      transition: all 0.2s;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .ov-close-btn:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }
    
    /* Lead Info Card */
    .ov-lead-card {
      margin: 12px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 12px;
      padding: 14px;
    }
    
    .ov-lead-header {
      display: flex;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    
    .ov-lead-avatar {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      margin-right: 12px;
      flex-shrink: 0;
    }
    
    .ov-lead-info {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .ov-lead-name {
      font-size: 14px;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-lead-phone {
      font-size: 11px;
      color: #64748b;
      font-family: 'SF Mono', Monaco, monospace;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .ov-copy-phone {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 2px;
      font-size: 11px;
      opacity: 0.7;
      transition: all 0.2s;
    }
    
    .ov-copy-phone:hover {
      opacity: 1;
      color: #22c55e;
    }
    
    .ov-lead-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    
    .ov-stat-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    
    .ov-stat-value {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    
    .ov-stat-value.success { color: #22c55e; }
    .ov-stat-value.warning { color: #f59e0b; }
    .ov-stat-value.danger { color: #ef4444; }
    .ov-stat-value.info { color: #64748b; }
    
    .ov-stat-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }
    
    /* Content */
    #ov-sidebar-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px;
    }
    
    #ov-sidebar-content::-webkit-scrollbar {
      width: 4px;
    }
    
    #ov-sidebar-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    #ov-sidebar-content::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.3);
      border-radius: 2px;
    }
    
    .ov-section {
      margin-bottom: 16px;
    }
    
    .ov-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    
    .ov-section-title {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    
    .ov-section-count {
      font-size: 10px;
      color: #475569;
    }
    
    /* Transaction Cards */
    .ov-tx-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .ov-tx-card {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }
    
    .ov-tx-card:hover {
      background: rgba(15, 23, 42, 0.8);
      border-color: rgba(34, 197, 94, 0.3);
    }
    
    .ov-tx-card.boleto { border-left: 3px solid #f59e0b; }
    .ov-tx-card.pix { border-left: 3px solid #22c55e; }
    .ov-tx-card.cartao { border-left: 3px solid #8b5cf6; }
    
    .ov-tx-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    
    .ov-tx-row + .ov-tx-row {
      margin-top: 6px;
    }
    
    .ov-tx-product {
      font-size: 12px;
      font-weight: 500;
      color: #e2e8f0;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .ov-tx-amount {
      font-size: 13px;
      font-weight: 700;
      color: #22c55e;
      flex-shrink: 0;
    }
    
    .ov-tx-badges {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    
    .ov-tx-badge {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    
    .ov-tx-badge.boleto { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .ov-tx-badge.pix { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .ov-tx-badge.cartao { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
    .ov-tx-badge.gerado { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .ov-tx-badge.pendente { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .ov-tx-badge.pago { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .ov-tx-badge.cancelado { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    .ov-tx-badge.expirado { background: rgba(100, 116, 139, 0.15); color: #64748b; }
    
    .ov-tx-date {
      font-size: 10px;
      color: #475569;
      flex-shrink: 0;
    }
    
    .ov-tx-actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    
    .ov-tx-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px 8px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 6px;
      color: #22c55e;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    
    .ov-tx-action-btn:hover {
      background: rgba(34, 197, 94, 0.2);
      border-color: rgba(34, 197, 94, 0.4);
    }
    
    .ov-tx-action-btn.download {
      background: rgba(59, 130, 246, 0.1);
      border-color: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
    }
    
    .ov-tx-action-btn.download:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.4);
    }
    
    /* Barcode */
    .ov-barcode-box {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 8px 10px;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    
    .ov-barcode-info {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .ov-barcode-label {
      font-size: 8px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    
    .ov-barcode-value {
      font-size: 10px;
      color: #94a3b8;
      font-family: 'SF Mono', Monaco, monospace;
      word-break: break-all;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .ov-barcode-copy {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 4px;
      padding: 4px 8px;
      color: #22c55e;
      font-size: 9px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      font-family: inherit;
      flex-shrink: 0;
    }
    
    .ov-barcode-copy:hover {
      background: rgba(34, 197, 94, 0.2);
    }
    
    /* Empty State */
    .ov-empty {
      text-align: center;
      padding: 40px 20px;
    }
    
    .ov-empty-icon {
      width: 56px;
      height: 56px;
      background: rgba(100, 116, 139, 0.1);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 14px;
      font-size: 24px;
    }
    
    .ov-empty-title {
      font-size: 13px;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    
    .ov-empty-text {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
    
    /* Accordion Links Úteis */
    .ov-accordion {
      margin-bottom: 16px;
    }
    
    .ov-accordion-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .ov-accordion-header:hover {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%);
      border-color: rgba(59, 130, 246, 0.3);
    }
    
    .ov-accordion-header.open {
      border-radius: 10px 10px 0 0;
      border-bottom: none;
    }
    
    .ov-accordion-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .ov-accordion-icon {
      font-size: 14px;
    }
    
    .ov-accordion-title {
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
    }
    
    .ov-accordion-count {
      font-size: 10px;
      color: #64748b;
      background: rgba(100, 116, 139, 0.2);
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .ov-accordion-arrow {
      font-size: 10px;
      color: #64748b;
      transition: transform 0.2s;
    }
    
    .ov-accordion-header.open .ov-accordion-arrow {
      transform: rotate(180deg);
    }
    
    .ov-accordion-content {
      display: none;
      padding: 10px;
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-top: none;
      border-radius: 0 0 10px 10px;
    }
    
    .ov-accordion-content.open {
      display: block;
    }
    
    .ov-links-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .ov-link-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      transition: all 0.2s;
    }
    
    .ov-link-card:hover {
      background: rgba(15, 23, 42, 0.8);
      border-color: rgba(59, 130, 246, 0.3);
    }
    
    .ov-link-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .ov-link-info {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .ov-link-title {
      font-size: 12px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-link-desc {
      font-size: 10px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 3px;
    }
    
    .ov-link-copy-btn {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 6px;
      padding: 8px 12px;
      color: #60a5fa;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
      font-family: inherit;
    }
    
    .ov-link-copy-btn:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.4);
    }
    
    /* Toggle Button */
    .ov-toggle-btn {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      width: 28px;
      height: 70px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: -4px 0 20px rgba(34, 197, 94, 0.3);
    }
    
    .ov-toggle-btn:hover {
      width: 36px;
    }
    
    .ov-toggle-btn-icon {
      font-size: 14px;
      color: white;
    }
    
    body.ov-sidebar-open .ov-toggle-btn {
      right: ${SIDEBAR_WIDTH}px;
    }
    
    /* Recovery View */
    .ov-recovery-view {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    .ov-recovery-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, transparent 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      flex-shrink: 0;
    }
    
    .ov-back-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      cursor: pointer;
      padding: 0;
      font-size: 16px;
      line-height: 1;
      border-radius: 6px;
      transition: all 0.2s;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .ov-back-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #f8fafc;
    }
    
    .ov-recovery-title-box {
      min-width: 0;
    }
    
    .ov-recovery-title {
      font-size: 14px;
      font-weight: 600;
      color: #f8fafc;
    }
    
    .ov-recovery-subtitle {
      font-size: 10px;
      color: rgba(148, 163, 184, 0.8);
    }
    
    .ov-recovery-body {
      padding: 12px;
      overflow-y: auto;
      flex: 1;
    }
    
    /* Client Data Section */
    .ov-client-section {
      margin-bottom: 20px;
    }
    
    .ov-client-section-title {
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }
    
    .ov-client-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      margin-bottom: 6px;
    }
    
    .ov-client-icon {
      font-size: 12px;
      color: #64748b;
      width: 18px;
      text-align: center;
      flex-shrink: 0;
    }
    
    .ov-client-content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .ov-client-label {
      font-size: 9px;
      color: #64748b;
      margin-bottom: 1px;
    }
    
    .ov-client-value {
      font-size: 12px;
      color: #e2e8f0;
      font-weight: 500;
      word-break: break-all;
      overflow-wrap: break-word;
    }
    
    .ov-client-value.mono {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 11px;
    }
    
    .ov-client-value.success {
      color: #22c55e;
    }
    
    .ov-client-copy-btn {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 6px;
      padding: 6px;
      color: #22c55e;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 12px;
      flex-shrink: 0;
    }
    
    .ov-client-copy-btn:hover {
      background: rgba(34, 197, 94, 0.2);
    }
    
    /* Messages Section */
    .ov-messages-section {
      margin-top: 20px;
    }
    
    .ov-message-block {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
      position: relative;
    }
    
    .ov-message-text {
      font-size: 12px;
      color: #e2e8f0;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: break-word;
      margin-bottom: 10px;
      padding-right: 60px;
    }
    
    .ov-message-copy {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 4px;
      padding: 4px 8px;
      color: #22c55e;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 3px;
      font-family: inherit;
    }
    
    .ov-message-copy:hover {
      background: rgba(34, 197, 94, 0.2);
    }
    
    .ov-file-block {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .ov-file-icon {
      width: 38px;
      height: 38px;
      background: rgba(59, 130, 246, 0.15);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    
    .ov-file-info {
      flex: 1;
      min-width: 0;
    }
    
    .ov-file-name {
      font-size: 12px;
      font-weight: 500;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-file-hint {
      font-size: 10px;
      color: #64748b;
      margin-top: 1px;
    }
    
    .ov-file-download {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      color: #3b82f6;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: inherit;
      flex-shrink: 0;
      white-space: nowrap;
    }
    
    .ov-file-download:hover {
      background: rgba(59, 130, 246, 0.2);
    }
    
    /* Loading */
    .ov-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 50px;
      color: #64748b;
      gap: 14px;
    }
    
    .ov-spinner {
      width: 28px;
      height: 28px;
      border: 2px solid rgba(34, 197, 94, 0.2);
      border-top-color: #22c55e;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Toast */
    .ov-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      z-index: 100001;
      animation: toastIn 0.25s ease;
      box-shadow: 0 10px 30px rgba(34, 197, 94, 0.3);
    }
    
    @keyframes toastIn {
      from { opacity: 0; transform: translate(-50%, 16px); }
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
        <div>
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
  
  // Event listener para fechar
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
  
  // Update toggle button icon
  const toggleBtn = document.getElementById('ov-toggle-btn');
  if (toggleBtn) toggleBtn.innerHTML = `<span class="ov-toggle-btn-icon">▶</span>`;
  
  // Carregar dados do lead atual
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
  
  // Update toggle button icon
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
      <div class="ov-empty">
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
  
  // Gera HTML para links úteis com accordion
  const linksHtml = usefulLinks.length > 0 ? `
    <div class="ov-accordion">
      <div class="ov-accordion-header" id="ov-links-accordion">
        <div class="ov-accordion-title-row">
          <span class="ov-accordion-icon">🔗</span>
          <span class="ov-accordion-title">Links Úteis</span>
          <span class="ov-accordion-count">${usefulLinks.length}</span>
        </div>
        <span class="ov-accordion-arrow">▼</span>
      </div>
      <div class="ov-accordion-content" id="ov-links-content">
        <div class="ov-links-list">
          ${usefulLinks.map(link => `
            <div class="ov-link-card">
              <div class="ov-link-icon">🌐</div>
              <div class="ov-link-info">
                <div class="ov-link-title">${link.title}</div>
                ${link.description ? `<div class="ov-link-desc">${link.description}</div>` : ''}
              </div>
              <button class="ov-link-copy-btn" data-copy="${link.url}">Copiar</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : '';
  
  container.innerHTML = `
    <div class="ov-lead-card">
      <div class="ov-lead-header">
        <div class="ov-lead-avatar">${initials || '?'}</div>
        <div class="ov-lead-info">
          <div class="ov-lead-name">${customerName}</div>
          <div class="ov-lead-phone">
            ${displayPhone}
            <button class="ov-copy-phone" data-copy="${currentPhone}" title="Copiar">📋</button>
          </div>
        </div>
      </div>
      <div class="ov-lead-stats">
        <div class="ov-stat-box">
          <div class="ov-stat-value success">${formatCurrency(totalPaid)}</div>
          <div class="ov-stat-label">Total Pago</div>
        </div>
        <div class="ov-stat-box">
          <div class="ov-stat-value warning">${formatCurrency(totalPending)}</div>
          <div class="ov-stat-label">Pendente</div>
        </div>
        <div class="ov-stat-box">
          <div class="ov-stat-value info">${transactions.length}</div>
          <div class="ov-stat-label">Transações</div>
        </div>
        <div class="ov-stat-box">
          <div class="ov-stat-value danger">${abandoned.length}</div>
          <div class="ov-stat-label">Abandonos</div>
        </div>
      </div>
    </div>
    
    ${linksHtml}
    
    ${transactions.length > 0 ? `
      <div class="ov-section">
        <div class="ov-section-header">
          <span class="ov-section-title">📋 Histórico de Transações</span>
          <span class="ov-section-count">${transactions.length}</span>
        </div>
        <div class="ov-tx-list">
          ${transactions.map(tx => renderTransactionCard(tx)).join('')}
        </div>
      </div>
    ` : ''}
    
    ${abandoned.length > 0 ? `
      <div class="ov-section">
        <div class="ov-section-header">
          <span class="ov-section-title">⚠️ Abandonos</span>
          <span class="ov-section-count">${abandoned.length}</span>
        </div>
        <div class="ov-tx-list">
          ${abandoned.map(ab => renderAbandonedCard(ab)).join('')}
        </div>
      </div>
    ` : ''}
    
    ${transactions.length === 0 && abandoned.length === 0 ? `
      <div class="ov-empty" style="padding: 24px;">
        <div class="ov-empty-title">Sem histórico</div>
        <div class="ov-empty-text">Nenhuma transação ou evento encontrado para este lead</div>
      </div>
    ` : ''}
  `;
  
  // Event listeners para copiar
  container.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(btn.dataset.copy);
    });
  });
  
  // Event listener para accordion
  const accordionHeader = container.querySelector('#ov-links-accordion');
  const accordionContent = container.querySelector('#ov-links-content');
  if (accordionHeader && accordionContent) {
    accordionHeader.addEventListener('click', () => {
      accordionHeader.classList.toggle('open');
      accordionContent.classList.toggle('open');
    });
  }
}

function renderTransactionCard(tx) {
  const boletoUrl = tx.metadata?.boleto_url || tx.metadata?.boletoUrl;
  const barcode = tx.external_id;
  const customerName = tx.customer_name || 'Transação';
  const isPending = ['gerado', 'pendente'].includes(tx.status);
  
  return `
    <div class="ov-tx-card ${tx.type}">
      <div class="ov-tx-row">
        <div class="ov-tx-product">${tx.description || customerName}</div>
        <div class="ov-tx-amount">${formatCurrency(tx.amount)}</div>
      </div>
      <div class="ov-tx-row">
        <div class="ov-tx-badges">
          <span class="ov-tx-badge ${tx.type}">${tx.type}</span>
          <span class="ov-tx-badge ${tx.status}">${tx.status}</span>
        </div>
        <span class="ov-tx-date">${formatDate(tx.created_at)}</span>
      </div>
      ${barcode && isPending ? `
        <div class="ov-barcode-box">
          <div class="ov-barcode-info">
            <div class="ov-barcode-label">Código de Barras</div>
            <div class="ov-barcode-value">${barcode.slice(0, 25)}...</div>
          </div>
          <button class="ov-barcode-copy" data-copy="${barcode}">📋</button>
        </div>
      ` : ''}
      ${boletoUrl && isPending ? `
        <div class="ov-tx-actions">
          <button class="ov-tx-action-btn download" onclick="window.open('${boletoUrl}', '_blank')">
            📥 Ver Boleto
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAbandonedCard(ab) {
  return `
    <div class="ov-tx-card" style="border-left: 3px solid #ef4444;">
      <div class="ov-tx-row">
        <div class="ov-tx-product">${ab.product_name || ab.event_type || 'Abandono'}</div>
        ${ab.amount ? `<div class="ov-tx-amount" style="color: #ef4444;">${formatCurrency(ab.amount)}</div>` : ''}
      </div>
      <div class="ov-tx-row">
        <div class="ov-tx-badges">
          <span class="ov-tx-badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">${ab.event_type || 'abandono'}</span>
          ${ab.funnel_stage ? `<span class="ov-tx-badge" style="background: rgba(100, 116, 139, 0.15); color: #64748b;">${ab.funnel_stage}</span>` : ''}
        </div>
        <span class="ov-tx-date">${formatDate(ab.created_at)}</span>
      </div>
    </div>
  `;
}

// ========== FUNÇÕES DE DOWNLOAD ==========
function downloadFileDirect(url, filename) {
  // Usar fetch para baixar o arquivo e criar blob
  showToast('Iniciando download...');
  
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Erro no download');
      return response.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showToast('Download concluído!');
    })
    .catch(err => {
      console.error('Erro no download:', err);
      showToast('Erro no download');
    });
}

// JPG não é possível no contexto do WhatsApp devido a CSP
// Função redirecionada para baixar PDF
function convertPdfToJpgAndDownload(pdfUrl, filename) {
  // Baixa o PDF diretamente - conversão JPG bloqueada por CSP
  downloadFileDirect(pdfUrl, filename.replace('.jpg', '.pdf'));
}

function generateDefaultMessage(tx) {
  const greeting = getGreeting();
  const name = tx.customer_name?.split(' ')[0] || 'Cliente';
  const amount = formatCurrency(tx.amount);
  return `${greeting} ${name}, tudo bem? 😊\n\nSeu boleto no valor de ${amount} está disponível. Qualquer dúvida estou à disposição!`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

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

// ========== UTILIDADES ==========
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
  
  // Generate all phone variations for search
  const variations = generatePhoneVariations(phone);
  console.log('[WhatsApp Extension] Variações do telefone:', variations);
  
  const content = document.getElementById('ov-sidebar-content');
  if (content) {
    content.innerHTML = `<div class="ov-loading"><div class="ov-spinner"></div><span>Carregando lead...</span></div>`;
  }
  
  try {
    // Send all variations to the API
    const phoneParam = variations.join(',');
    const response = await fetch(`${API_URL}?action=lead&phone=${encodeURIComponent(phoneParam)}`);
    currentLeadData = await response.json();
    
    console.log('[WhatsApp Extension] Dados recebidos:', currentLeadData);
    
    renderContent();
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao carregar lead:', error);
    if (content) {
      content.innerHTML = `<div class="ov-empty"><div class="ov-empty-title">Erro ao carregar</div></div>`;
    }
  }
}

// ========== DETECÇÃO DE CONVERSA ==========
function extractPhoneFromConversation() {
  // Método 1: Header da conversa
  const headerSpans = document.querySelectorAll('header span[title], header span[dir="auto"]');
  for (const span of headerSpans) {
    const text = span.getAttribute('title') || span.textContent || '';
    const phone = extractPhoneFromText(text);
    if (phone) return phone;
  }
  
  // Método 2: Seletor específico do WhatsApp
  const conversationTitle = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
  if (conversationTitle) {
    const text = conversationTitle.textContent || '';
    const phone = extractPhoneFromText(text);
    if (phone) return phone;
  }
  
  // Método 3: data-jid
  const jidElements = document.querySelectorAll('[data-jid]');
  for (const el of jidElements) {
    const jid = el.getAttribute('data-jid');
    if (jid && jid.includes('@')) {
      const phone = jid.split('@')[0];
      if (/^\d{10,15}$/.test(phone)) return phone;
    }
  }
  
  // Método 4: URL
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
      
      // Reset view when conversation changes
      currentView = 'lead';
      currentRecoveryTx = null;
      
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
function waitForElement(selector, timeout = 1500) {
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
    // Primeiro tenta encontrar se já existe uma conversa
    // Procura no painel lateral esquerdo por conversas existentes
    const existingChat = document.querySelector(`[data-testid="cell-frame-container"][title*="${formatted}"], [data-jid="${formatted}@s.whatsapp.net"]`);
    if (existingChat) {
      console.log('[WhatsApp Extension] Conversa existente encontrada, clicando...');
      existingChat.click();
      await new Promise(r => setTimeout(r, 500));
      return true;
    }
    
    // Abre nova conversa usando o botão "Nova conversa"
    const newChatSelectors = [
      '[data-testid="menu-bar-new-chat"]',
      'button[data-tab="2"]',
      'span[data-icon="new-chat"]',
      'div[title="Nova conversa"]',
      '[aria-label="Nova conversa"]'
    ];
    
    let newChatBtn = null;
    for (const selector of newChatSelectors) {
      newChatBtn = document.querySelector(selector);
      if (newChatBtn) break;
    }
    
    if (!newChatBtn) {
      console.error('[WhatsApp Extension] Botão Nova Conversa não encontrado');
      return false;
    }
    
    newChatBtn.click();
    await new Promise(r => setTimeout(r, 600));
    
    // Procura campo de busca
    const searchSelectors = [
      '[data-testid="chat-list-search"]',
      'div[contenteditable="true"][data-tab="3"]',
      '[data-testid="search-input"]',
      'input[type="text"]'
    ];
    
    let searchInput = null;
    for (const selector of searchSelectors) {
      searchInput = document.querySelector(selector);
      if (searchInput) break;
    }
    
    if (!searchInput) {
      console.error('[WhatsApp Extension] Campo de busca não encontrado');
      return false;
    }
    
    console.log('[WhatsApp Extension] Digitando número:', formatted);
    simulateTyping(searchInput, formatted);
    await new Promise(r => setTimeout(r, 1200));
    
    // Procura resultado da busca - múltiplos seletores
    const resultSelectors = [
      '[data-testid="cell-frame-container"]',
      'div[tabindex="-1"][role="option"]',
      'div[data-testid="chat-list"] > div',
      '.copyable-area div[role="listitem"]',
      '[data-testid="list-item-active"]'
    ];
    
    let contact = null;
    for (const selector of resultSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Verifica se é o contato correto
        const text = el.textContent || '';
        if (text.includes(formatted) || text.includes(formatted.slice(-8))) {
          contact = el;
          break;
        }
      }
      if (contact) break;
    }
    
    // Se não encontrou por texto, pega o primeiro resultado
    if (!contact) {
      for (const selector of resultSelectors) {
        contact = document.querySelector(selector);
        if (contact) break;
      }
    }
    
    if (contact) {
      console.log('[WhatsApp Extension] Contato encontrado, clicando...');
      contact.click();
      await new Promise(r => setTimeout(r, 500));
      return true;
    }
    
    console.error('[WhatsApp Extension] Nenhum contato encontrado');
    return false;
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao abrir chat:', error);
    return false;
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
