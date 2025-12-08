// Content Script - WhatsApp Web
// Executa ações na interface do WhatsApp + Mini Dashboard Refinado

console.log('[WhatsApp Extension] Content script carregado');

// ========== CONFIGURAÇÃO ==========
const API_URL = 'https://suaznqybxvborpkrtdpm.supabase.co/functions/v1/whatsapp-dashboard';

// ========== ESTADO GLOBAL ==========
let currentPhone = null;
let sidebarVisible = false;
let recentTransactions = [];
let currentLeadData = null;

// Registra no background
chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('[WhatsApp Extension] Erro ao registrar:', chrome.runtime.lastError);
  } else {
    console.log('[WhatsApp Extension] Registrado no background');
  }
});

// ========== ESTILOS CSS ==========
function injectStyles() {
  if (document.getElementById('ov-dashboard-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'ov-dashboard-styles';
  styles.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    #ov-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: 380px;
      height: 100vh;
      background: linear-gradient(180deg, #0a0f14 0%, #0d1318 100%);
      border-left: 1px solid rgba(34, 197, 94, 0.2);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', -apple-system, sans-serif;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
    }
    
    #ov-sidebar.hidden {
      transform: translateX(100%);
    }
    
    #ov-sidebar-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, transparent 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .ov-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .ov-logo-container {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    }
    
    .ov-logo {
      width: 22px;
      height: 22px;
      border-radius: 4px;
    }
    
    .ov-header-title {
      font-size: 15px;
      font-weight: 600;
      color: #f8fafc;
      letter-spacing: -0.3px;
    }
    
    .ov-header-subtitle {
      font-size: 11px;
      color: rgba(148, 163, 184, 0.8);
      margin-top: 1px;
    }
    
    .ov-close-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      cursor: pointer;
      padding: 8px;
      font-size: 14px;
      line-height: 1;
      border-radius: 8px;
      transition: all 0.2s;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .ov-close-btn:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }
    
    /* Lead Info Card */
    .ov-lead-card {
      margin: 16px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 14px;
      padding: 18px;
    }
    
    .ov-lead-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    
    .ov-lead-avatar {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      margin-right: 14px;
      flex-shrink: 0;
    }
    
    .ov-lead-info {
      flex: 1;
      min-width: 0;
    }
    
    .ov-lead-name {
      font-size: 16px;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ov-lead-phone {
      font-size: 12px;
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
      font-size: 12px;
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
      gap: 10px;
    }
    
    .ov-stat-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 12px;
      text-align: center;
    }
    
    .ov-stat-value {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    
    .ov-stat-value.success { color: #22c55e; }
    .ov-stat-value.warning { color: #f59e0b; }
    .ov-stat-value.danger { color: #ef4444; }
    .ov-stat-value.info { color: #64748b; }
    
    .ov-stat-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }
    
    /* Tabs */
    #ov-sidebar-tabs {
      display: flex;
      padding: 0 16px;
      gap: 4px;
      background: transparent;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    
    .ov-tab {
      flex: 1;
      padding: 12px 8px;
      background: none;
      border: none;
      color: #64748b;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      font-family: inherit;
    }
    
    .ov-tab.active {
      color: #22c55e;
      border-bottom-color: #22c55e;
    }
    
    .ov-tab:hover:not(.active) {
      color: #94a3b8;
    }
    
    .ov-tab-badge {
      background: #22c55e;
      color: #0a0f14;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      margin-left: 6px;
    }
    
    /* Content */
    #ov-sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
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
      margin-bottom: 20px;
    }
    
    .ov-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .ov-section-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    
    .ov-section-count {
      font-size: 11px;
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
      border-radius: 12px;
      padding: 14px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    
    .ov-tx-card:hover {
      background: rgba(15, 23, 42, 0.8);
      border-color: rgba(34, 197, 94, 0.3);
      transform: translateY(-1px);
    }
    
    .ov-tx-card.boleto { border-left: 3px solid #f59e0b; }
    .ov-tx-card.pix { border-left: 3px solid #22c55e; }
    .ov-tx-card.cartao { border-left: 3px solid #8b5cf6; }
    
    .ov-tx-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .ov-tx-row + .ov-tx-row {
      margin-top: 8px;
    }
    
    .ov-tx-product {
      font-size: 13px;
      font-weight: 500;
      color: #e2e8f0;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .ov-tx-amount {
      font-size: 14px;
      font-weight: 700;
      color: #22c55e;
    }
    
    .ov-tx-badges {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .ov-tx-badge {
      font-size: 9px;
      padding: 3px 8px;
      border-radius: 6px;
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
      font-size: 11px;
      color: #475569;
    }
    
    .ov-tx-actions {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    
    .ov-tx-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 10px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 8px;
      color: #22c55e;
      font-size: 11px;
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
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    
    .ov-barcode-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .ov-barcode-value {
      font-size: 11px;
      color: #94a3b8;
      font-family: 'SF Mono', Monaco, monospace;
      word-break: break-all;
    }
    
    .ov-barcode-copy {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      color: #22c55e;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      font-family: inherit;
    }
    
    .ov-barcode-copy:hover {
      background: rgba(34, 197, 94, 0.2);
    }
    
    /* Empty State */
    .ov-empty {
      text-align: center;
      padding: 60px 24px;
    }
    
    .ov-empty-icon {
      width: 64px;
      height: 64px;
      background: rgba(100, 116, 139, 0.1);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 28px;
    }
    
    .ov-empty-title {
      font-size: 14px;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    
    .ov-empty-text {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    
    /* Toggle Button */
    .ov-toggle-btn {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      width: 32px;
      height: 80px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border: none;
      border-radius: 10px 0 0 10px;
      cursor: pointer;
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: -4px 0 20px rgba(34, 197, 94, 0.3);
    }
    
    .ov-toggle-btn:hover {
      width: 40px;
    }
    
    .ov-toggle-btn svg {
      width: 18px;
      height: 18px;
      fill: white;
    }
    
    .ov-toggle-btn.sidebar-open {
      right: 380px;
    }
    
    /* Recovery Modal */
    .ov-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    
    .ov-modal {
      background: linear-gradient(180deg, #0f172a 0%, #0a0f14 100%);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 16px;
      width: 90%;
      max-width: 520px;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
    }
    
    .ov-modal-header {
      padding: 20px 24px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, transparent 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .ov-modal-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .ov-modal-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    
    .ov-modal-title {
      font-size: 16px;
      font-weight: 600;
      color: #f8fafc;
    }
    
    .ov-modal-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    
    .ov-modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    
    /* Client Data Section */
    .ov-client-section {
      margin-bottom: 24px;
    }
    
    .ov-client-section-title {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
    }
    
    .ov-client-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      margin-bottom: 8px;
    }
    
    .ov-client-icon {
      font-size: 14px;
      color: #64748b;
      width: 20px;
      text-align: center;
    }
    
    .ov-client-content {
      flex: 1;
      min-width: 0;
    }
    
    .ov-client-label {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 2px;
    }
    
    .ov-client-value {
      font-size: 13px;
      color: #e2e8f0;
      font-weight: 500;
    }
    
    .ov-client-value.mono {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
    }
    
    .ov-client-value.success {
      color: #22c55e;
    }
    
    .ov-client-copy-btn {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 8px;
      padding: 8px;
      color: #22c55e;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    
    .ov-client-copy-btn:hover {
      background: rgba(34, 197, 94, 0.2);
    }
    
    /* Messages Section */
    .ov-messages-section {
      margin-top: 24px;
    }
    
    .ov-message-block {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      position: relative;
    }
    
    .ov-message-text {
      font-size: 13px;
      color: #e2e8f0;
      line-height: 1.7;
      white-space: pre-wrap;
      margin-bottom: 12px;
    }
    
    .ov-message-copy {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      color: #22c55e;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: inherit;
    }
    
    .ov-message-copy:hover {
      background: rgba(34, 197, 94, 0.2);
    }
    
    .ov-file-block {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .ov-file-icon {
      width: 44px;
      height: 44px;
      background: rgba(59, 130, 246, 0.15);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    
    .ov-file-info {
      flex: 1;
    }
    
    .ov-file-name {
      font-size: 13px;
      font-weight: 500;
      color: #e2e8f0;
    }
    
    .ov-file-hint {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    
    .ov-file-download {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 8px;
      padding: 8px 14px;
      color: #3b82f6;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
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
      padding: 60px;
      color: #64748b;
      gap: 16px;
    }
    
    .ov-spinner {
      width: 32px;
      height: 32px;
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
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 13px;
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
        <div class="ov-logo-container">
          <img src="${chrome.runtime.getURL('icon48.png')}" class="ov-logo" alt="Logo">
        </div>
        <div>
          <div class="ov-header-title">Origem Viva</div>
          <div class="ov-header-subtitle">Painel de Recuperação</div>
        </div>
      </div>
      <button class="ov-close-btn" onclick="toggleSidebar()">✕</button>
    </div>
    <div id="ov-sidebar-tabs">
      <button class="ov-tab active" data-tab="lead">Lead Atual</button>
      <button class="ov-tab" data-tab="today">Hoje</button>
      <button class="ov-tab" data-tab="history">Histórico</button>
    </div>
    <div id="ov-sidebar-content">
      <div class="ov-empty">
        <div class="ov-empty-icon">💬</div>
        <div class="ov-empty-title">Selecione uma conversa</div>
        <div class="ov-empty-text">Os dados do lead aparecerão aqui</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  // Event listeners para tabs
  sidebar.querySelectorAll('.ov-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      sidebar.querySelectorAll('.ov-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderContent(tab.dataset.tab);
    });
  });
}

function createToggleButton() {
  if (document.getElementById('ov-toggle-btn')) return;
  
  const btn = document.createElement('button');
  btn.id = 'ov-toggle-btn';
  btn.className = 'ov-toggle-btn';
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`;
  btn.onclick = toggleSidebar;
  document.body.appendChild(btn);
}

function toggleSidebar() {
  const sidebar = document.getElementById('ov-sidebar');
  const btn = document.getElementById('ov-toggle-btn');
  
  if (sidebar.classList.contains('hidden')) {
    sidebar.classList.remove('hidden');
    btn.classList.add('sidebar-open');
    sidebarVisible = true;
    loadRecentTransactions();
    
    if (currentPhone) {
      loadLeadData(currentPhone);
    }
  } else {
    sidebar.classList.add('hidden');
    btn.classList.remove('sidebar-open');
    sidebarVisible = false;
  }
}
window.toggleSidebar = toggleSidebar;

// ========== RENDERIZAÇÃO ==========
function renderContent(tab) {
  const content = document.getElementById('ov-sidebar-content');
  
  if (tab === 'lead') {
    renderLeadContent(content);
  } else if (tab === 'today') {
    renderTodayContent(content);
  } else {
    renderHistoryContent(content);
  }
}

function renderLeadContent(container) {
  if (!currentLeadData || !currentPhone) {
    container.innerHTML = `
      <div class="ov-empty">
        <div class="ov-empty-icon">💬</div>
        <div class="ov-empty-title">Selecione uma conversa</div>
        <div class="ov-empty-text">Os dados do lead aparecerão aqui</div>
      </div>
    `;
    return;
  }
  
  const { customer, transactions = [], abandoned = [] } = currentLeadData;
  const paidTxs = transactions.filter(t => t.status === 'pago');
  const pendingTxs = transactions.filter(t => ['gerado', 'pendente'].includes(t.status));
  const totalPaid = paidTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalPending = pendingTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  
  const displayPhone = formatDisplayPhone(currentPhone);
  const customerName = customer?.name || transactions[0]?.customer_name || abandoned[0]?.customer_name || 'Lead';
  const initials = customerName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  
  container.innerHTML = `
    <div class="ov-lead-card">
      <div class="ov-lead-header">
        <div class="ov-lead-avatar">${initials || '?'}</div>
        <div class="ov-lead-info">
          <div class="ov-lead-name">${customerName}</div>
          <div class="ov-lead-phone">
            ${displayPhone}
            <button class="ov-copy-phone" onclick="copyToClipboard('${currentPhone}')" title="Copiar">📋</button>
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
          <div class="ov-stat-value info">${paidTxs.length}</div>
          <div class="ov-stat-label">Pagas</div>
        </div>
        <div class="ov-stat-box">
          <div class="ov-stat-value warning">${pendingTxs.length}</div>
          <div class="ov-stat-label">Pendentes</div>
        </div>
      </div>
    </div>
    
    ${pendingTxs.length > 0 ? `
      <div class="ov-section">
        <div class="ov-section-header">
          <span class="ov-section-title">🔔 Pendentes</span>
          <span class="ov-section-count">${pendingTxs.length} boleto(s)</span>
        </div>
        <div class="ov-tx-list">
          ${pendingTxs.map(tx => renderPendingCard(tx)).join('')}
        </div>
      </div>
    ` : ''}
    
    ${paidTxs.length > 0 ? `
      <div class="ov-section">
        <div class="ov-section-header">
          <span class="ov-section-title">✅ Pagas</span>
          <span class="ov-section-count">${paidTxs.length}</span>
        </div>
        <div class="ov-tx-list">
          ${paidTxs.slice(0, 5).map(tx => renderSimpleCard(tx)).join('')}
        </div>
      </div>
    ` : ''}
    
    ${transactions.length === 0 && abandoned.length === 0 ? `
      <div class="ov-empty" style="padding: 30px;">
        <div class="ov-empty-title">Sem dados</div>
        <div class="ov-empty-text">Nenhuma transação encontrada</div>
      </div>
    ` : ''}
  `;
  
  // Event listeners
  container.querySelectorAll('[data-action="recovery"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const txId = btn.dataset.txId;
      const tx = transactions.find(t => t.id === txId);
      if (tx) showRecoveryModal(tx);
    });
  });
  
  container.querySelectorAll('[data-action="download"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });
  
  container.querySelectorAll('[data-action="copy-barcode"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const barcode = btn.dataset.barcode;
      if (barcode) {
        navigator.clipboard.writeText(barcode);
        showToast('Código de barras copiado!');
      }
    });
  });
}

function renderTodayContent(container) {
  if (!currentLeadData) {
    container.innerHTML = `<div class="ov-empty"><div class="ov-empty-title">Carregue um lead primeiro</div></div>`;
    return;
  }
  
  const { transactions = [] } = currentLeadData;
  const today = new Date().toDateString();
  const todayTxs = transactions.filter(t => new Date(t.created_at).toDateString() === today);
  
  if (todayTxs.length === 0) {
    container.innerHTML = `
      <div class="ov-empty">
        <div class="ov-empty-icon">📅</div>
        <div class="ov-empty-title">Nenhuma transação hoje</div>
        <div class="ov-empty-text">Este lead não possui transações no dia de hoje</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="ov-section">
      <div class="ov-section-header">
        <span class="ov-section-title">📅 Transações de Hoje</span>
        <span class="ov-section-count">${todayTxs.length}</span>
      </div>
      <div class="ov-tx-list">
        ${todayTxs.map(tx => ['gerado', 'pendente'].includes(tx.status) ? renderPendingCard(tx) : renderSimpleCard(tx)).join('')}
      </div>
    </div>
  `;
  
  attachCardListeners(container);
}

function renderHistoryContent(container) {
  if (!currentLeadData) {
    container.innerHTML = `<div class="ov-empty"><div class="ov-empty-title">Carregue um lead primeiro</div></div>`;
    return;
  }
  
  const { transactions = [] } = currentLeadData;
  
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="ov-empty">
        <div class="ov-empty-icon">📜</div>
        <div class="ov-empty-title">Sem histórico</div>
        <div class="ov-empty-text">Este lead não possui transações anteriores</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="ov-section">
      <div class="ov-section-header">
        <span class="ov-section-title">📜 Histórico Completo</span>
        <span class="ov-section-count">${transactions.length} transações</span>
      </div>
      <div class="ov-tx-list">
        ${transactions.map(tx => ['gerado', 'pendente'].includes(tx.status) ? renderPendingCard(tx) : renderSimpleCard(tx)).join('')}
      </div>
    </div>
  `;
  
  attachCardListeners(container);
}

function attachCardListeners(container) {
  const { transactions = [] } = currentLeadData || {};
  
  container.querySelectorAll('[data-action="recovery"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const txId = btn.dataset.txId;
      const tx = transactions.find(t => t.id === txId);
      if (tx) showRecoveryModal(tx);
    });
  });
  
  container.querySelectorAll('[data-action="download"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });
  
  container.querySelectorAll('[data-action="copy-barcode"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const barcode = btn.dataset.barcode;
      if (barcode) {
        navigator.clipboard.writeText(barcode);
        showToast('Código de barras copiado!');
      }
    });
  });
}

function renderPendingCard(tx) {
  const boletoUrl = tx.metadata?.boleto_url || tx.metadata?.boletoUrl;
  const barcode = tx.external_id;
  
  return `
    <div class="ov-tx-card ${tx.type}">
      <div class="ov-tx-row">
        <div class="ov-tx-product">${tx.description || tx.customer_name || 'Boleto'}</div>
        <div class="ov-tx-amount">${formatCurrency(tx.amount)}</div>
      </div>
      <div class="ov-tx-row">
        <div class="ov-tx-badges">
          <span class="ov-tx-badge ${tx.type}">${tx.type}</span>
          <span class="ov-tx-badge ${tx.status}">${tx.status}</span>
        </div>
        <span class="ov-tx-date">${formatDate(tx.created_at)}</span>
      </div>
      ${barcode ? `
        <div class="ov-barcode-box">
          <div>
            <div class="ov-barcode-label">Código de Barras</div>
            <div class="ov-barcode-value">${barcode.slice(0, 24)}...</div>
          </div>
          <button class="ov-barcode-copy" data-action="copy-barcode" data-barcode="${barcode}">📋 Copiar</button>
        </div>
      ` : ''}
      <div class="ov-tx-actions">
        <button class="ov-tx-action-btn" data-action="recovery" data-tx-id="${tx.id}">
          💬 Recuperar
        </button>
        ${boletoUrl ? `
          <button class="ov-tx-action-btn download" data-action="download" data-url="${boletoUrl}">
            📥 Baixar
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderSimpleCard(tx) {
  return `
    <div class="ov-tx-card ${tx.type}">
      <div class="ov-tx-row">
        <div class="ov-tx-product">${tx.description || tx.customer_name || 'Transação'}</div>
        <div class="ov-tx-amount">${formatCurrency(tx.amount)}</div>
      </div>
      <div class="ov-tx-row">
        <div class="ov-tx-badges">
          <span class="ov-tx-badge ${tx.type}">${tx.type}</span>
          <span class="ov-tx-badge ${tx.status}">${tx.status}</span>
        </div>
        <span class="ov-tx-date">${formatDate(tx.created_at)}</span>
      </div>
    </div>
  `;
}

// ========== MODAL DE RECUPERAÇÃO ==========
function showRecoveryModal(tx) {
  const templates = currentLeadData?.recoveryTemplates;
  const blocks = templates?.blocks || [];
  const customerName = tx.customer_name || 'Cliente';
  const firstName = customerName.split(' ')[0];
  const amount = formatCurrency(tx.amount);
  const barcode = tx.external_id || '';
  const dueDate = tx.metadata?.due_date || tx.metadata?.vencimento || '-';
  const boletoUrl = tx.metadata?.boleto_url || tx.metadata?.boletoUrl;
  const greeting = getGreeting();
  
  // Process template blocks
  const processedBlocks = blocks.map(block => {
    if (block.type === 'text') {
      let text = block.content || '';
      text = text
        .replace(/{saudação}/gi, greeting)
        .replace(/{saudacao}/gi, greeting)
        .replace(/{nome}/gi, customerName)
        .replace(/{primeiro_nome}/gi, firstName)
        .replace(/{valor}/gi, amount)
        .replace(/{vencimento}/gi, dueDate)
        .replace(/{codigo_barras}/gi, barcode);
      return { ...block, processedContent: text };
    }
    return block;
  });
  
  const overlay = document.createElement('div');
  overlay.className = 'ov-modal-overlay';
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  
  overlay.innerHTML = `
    <div class="ov-modal">
      <div class="ov-modal-header">
        <div class="ov-modal-header-left">
          <div class="ov-modal-icon">📄</div>
          <div>
            <div class="ov-modal-title">Recuperação de Boleto</div>
            <div class="ov-modal-subtitle">Copie as mensagens para enviar ao cliente</div>
          </div>
        </div>
        <button class="ov-close-btn" onclick="this.closest('.ov-modal-overlay').remove()">✕</button>
      </div>
      <div class="ov-modal-body">
        <div class="ov-client-section">
          <div class="ov-client-section-title">Dados do Cliente</div>
          
          <div class="ov-client-row">
            <span class="ov-client-icon">👤</span>
            <div class="ov-client-content">
              <div class="ov-client-label">Nome do Cliente</div>
              <div class="ov-client-value">${customerName}</div>
            </div>
            <button class="ov-client-copy-btn" onclick="copyToClipboard('${customerName}')">📋</button>
          </div>
          
          <div class="ov-client-row">
            <span class="ov-client-icon">📞</span>
            <div class="ov-client-content">
              <div class="ov-client-label">Telefone</div>
              <div class="ov-client-value mono">${tx.customer_phone || currentPhone || '-'}</div>
            </div>
            <button class="ov-client-copy-btn" onclick="copyToClipboard('${tx.customer_phone || currentPhone || ''}')">📋</button>
          </div>
          
          <div class="ov-client-row">
            <span class="ov-client-icon">💰</span>
            <div class="ov-client-content">
              <div class="ov-client-label">Valor do Boleto</div>
              <div class="ov-client-value success">${amount}</div>
            </div>
            <button class="ov-client-copy-btn" onclick="copyToClipboard('${amount}')">📋</button>
          </div>
          
          ${barcode ? `
            <div class="ov-client-row">
              <span class="ov-client-icon">📊</span>
              <div class="ov-client-content">
                <div class="ov-client-label">Código de Barras</div>
                <div class="ov-client-value mono" style="font-size: 10px; word-break: break-all;">${barcode}</div>
              </div>
              <button class="ov-client-copy-btn" onclick="copyToClipboard('${barcode}')">📋</button>
            </div>
          ` : ''}
        </div>
        
        <div class="ov-messages-section">
          <div class="ov-client-section-title">Mensagens de Recuperação</div>
          
          ${processedBlocks.length > 0 ? processedBlocks.map((block, idx) => {
            if (block.type === 'text') {
              return `
                <div class="ov-message-block">
                  <button class="ov-message-copy" data-text="${encodeURIComponent(block.processedContent)}">📋 Copiar</button>
                  <div class="ov-message-text">${block.processedContent}</div>
                </div>
              `;
            } else if (block.type === 'pdf' && boletoUrl) {
              return `
                <div class="ov-file-block">
                  <div class="ov-file-icon">📄</div>
                  <div class="ov-file-info">
                    <div class="ov-file-name">boleto-${firstName}.pdf</div>
                    <div class="ov-file-hint">Clique para baixar</div>
                  </div>
                  <button class="ov-file-download" onclick="window.open('${boletoUrl}', '_blank')">📥 Baixar</button>
                </div>
              `;
            } else if (block.type === 'image' && boletoUrl) {
              return `
                <div class="ov-file-block">
                  <div class="ov-file-icon">🖼️</div>
                  <div class="ov-file-info">
                    <div class="ov-file-name">boleto-${firstName}.jpg</div>
                    <div class="ov-file-hint">Imagem do boleto</div>
                  </div>
                  <button class="ov-file-download" onclick="window.open('${boletoUrl}', '_blank')">📥 Ver</button>
                </div>
              `;
            }
            return '';
          }).join('') : `
            <div class="ov-message-block">
              <button class="ov-message-copy" data-text="${encodeURIComponent(generateDefaultMessage(tx))}">📋 Copiar</button>
              <div class="ov-message-text">${generateDefaultMessage(tx)}</div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Event listeners para copiar mensagens
  overlay.querySelectorAll('.ov-message-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = decodeURIComponent(btn.dataset.text);
      navigator.clipboard.writeText(text);
      showToast('Mensagem copiada!');
    });
  });
}

function generateDefaultMessage(tx) {
  const greeting = getGreeting();
  const firstName = (tx.customer_name || 'Cliente').split(' ')[0];
  const amount = formatCurrency(tx.amount);
  const barcode = tx.external_id || '';
  
  let msg = `${greeting} ${firstName}! 😊\n\nDeixei aqui o seu boleto para que você consiga pagar na lotérica. Tudo bem?`;
  
  if (barcode) {
    msg += `\n\n📄 Código de barras:\n${barcode}`;
  }
  
  msg += `\n\n💰 Valor: ${amount}`;
  
  return msg;
}

function getGreeting() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brasilTime = new Date(utc + (-3 * 3600000));
  const hour = brasilTime.getHours();
  
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

// Global copy function
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text);
  showToast('Copiado!');
};

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
async function loadRecentTransactions() {
  try {
    const response = await fetch(`${API_URL}?action=recent`);
    const data = await response.json();
    recentTransactions = data.transactions || [];
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao carregar transações:', error);
  }
}

async function loadLeadData(phone) {
  console.log('[WhatsApp Extension] Carregando dados do lead:', phone);
  
  const content = document.getElementById('ov-sidebar-content');
  if (content) {
    content.innerHTML = `<div class="ov-loading"><div class="ov-spinner"></div><span>Carregando lead...</span></div>`;
  }
  
  try {
    const response = await fetch(`${API_URL}?action=lead&phone=${encodeURIComponent(phone)}`);
    currentLeadData = await response.json();
    
    console.log('[WhatsApp Extension] Dados recebidos:', currentLeadData);
    
    // Ativa tab de lead
    document.querySelectorAll('.ov-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.ov-tab[data-tab="lead"]')?.classList.add('active');
    
    renderContent('lead');
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
  try {
    const newChatBtn = await waitForElement('button[data-tab="2"], button[aria-label="Nova conversa"]', 2000);
    newChatBtn.click();
    await new Promise(r => setTimeout(r, 500));
    const searchInput = await waitForElement('[data-testid="chat-list-search"], [contenteditable="true"]', 2000);
    simulateTyping(searchInput, formatted);
    await new Promise(r => setTimeout(r, 1000));
    const contact = await waitForElement(`[data-testid="cell-frame-container"], [data-jid*="${formatted}"]`, 3000);
    contact.click();
    return true;
  } catch (error) {
    console.error('[WhatsApp Extension] Erro ao abrir chat:', error);
    window.open(`https://web.whatsapp.com/send?phone=${formatted}`, '_blank');
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
