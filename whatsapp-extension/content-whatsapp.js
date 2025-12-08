// Content Script - WhatsApp Web
// Executa ações na interface do WhatsApp + Mini Dashboard

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
    #ov-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: 340px;
      height: 100vh;
      background: #0b141a;
      border-left: 1px solid #233138;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      transition: transform 0.25s ease;
    }
    
    #ov-sidebar.hidden {
      transform: translateX(100%);
    }
    
    #ov-sidebar-header {
      padding: 14px 16px;
      background: #111b21;
      border-bottom: 1px solid #233138;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    #ov-sidebar-header h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 500;
      color: #e9edef;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .ov-logo {
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }
    
    .ov-close-btn {
      background: none;
      border: none;
      color: #8696a0;
      cursor: pointer;
      padding: 6px;
      font-size: 18px;
      line-height: 1;
      border-radius: 50%;
      transition: background 0.2s;
    }
    
    .ov-close-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #e9edef;
    }
    
    #ov-sidebar-tabs {
      display: flex;
      background: #111b21;
    }
    
    .ov-tab {
      flex: 1;
      padding: 12px 8px;
      background: none;
      border: none;
      color: #8696a0;
      font-size: 13px;
      font-weight: 400;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    
    .ov-tab.active {
      color: #00a884;
      border-bottom-color: #00a884;
    }
    
    .ov-tab:hover:not(.active) {
      color: #e9edef;
    }
    
    #ov-sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      background: #0b141a;
    }
    
    #ov-sidebar-content::-webkit-scrollbar {
      width: 6px;
    }
    
    #ov-sidebar-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    #ov-sidebar-content::-webkit-scrollbar-thumb {
      background: #374045;
      border-radius: 3px;
    }
    
    .ov-lead-info {
      background: #111b21;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
    }
    
    .ov-lead-name {
      font-size: 16px;
      font-weight: 500;
      color: #e9edef;
      margin-bottom: 2px;
    }
    
    .ov-lead-phone {
      font-size: 12px;
      color: #8696a0;
      margin-bottom: 14px;
      font-family: monospace;
    }
    
    .ov-lead-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    
    .ov-stat {
      background: #1f2c33;
      border-radius: 8px;
      padding: 12px 10px;
      text-align: center;
    }
    
    .ov-stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #00a884;
    }
    
    .ov-stat-value.pending {
      color: #ffc107;
    }
    
    .ov-stat-value.abandoned {
      color: #ea4335;
    }
    
    .ov-stat-label {
      font-size: 10px;
      color: #8696a0;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .ov-section-title {
      font-size: 11px;
      font-weight: 500;
      color: #00a884;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 16px 0 8px;
      padding-left: 4px;
    }
    
    .ov-tx-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .ov-tx-card {
      background: #111b21;
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      transition: background 0.15s;
      border-left: 3px solid transparent;
    }
    
    .ov-tx-card:hover {
      background: #1f2c33;
    }
    
    .ov-tx-card.boleto {
      border-left-color: #ffc107;
    }
    
    .ov-tx-card.pix {
      border-left-color: #00a884;
    }
    
    .ov-tx-card.cartao {
      border-left-color: #8b5cf6;
    }
    
    .ov-tx-card.abandoned {
      border-left-color: #ea4335;
    }
    
    .ov-tx-card.recoverable {
      position: relative;
    }
    
    .ov-tx-card.recoverable::after {
      content: '💬';
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      opacity: 0.6;
    }
    
    .ov-tx-card.recoverable:hover::after {
      opacity: 1;
    }
    
    .ov-tx-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    
    .ov-tx-name {
      font-size: 13px;
      font-weight: 400;
      color: #e9edef;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .ov-tx-amount {
      font-size: 13px;
      font-weight: 600;
      color: #00a884;
    }
    
    .ov-tx-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .ov-tx-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.2px;
    }
    
    .ov-tx-badge.gerado { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
    .ov-tx-badge.pendente { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
    .ov-tx-badge.pago { background: rgba(0, 168, 132, 0.15); color: #00a884; }
    .ov-tx-badge.cancelado { background: rgba(234, 67, 53, 0.15); color: #ea4335; }
    .ov-tx-badge.expirado { background: rgba(134, 150, 160, 0.15); color: #8696a0; }
    .ov-tx-badge.abandoned { background: rgba(234, 67, 53, 0.15); color: #ea4335; }
    
    .ov-tx-date {
      font-size: 11px;
      color: #667781;
    }
    
    .ov-empty {
      text-align: center;
      padding: 50px 24px;
      color: #8696a0;
    }
    
    .ov-empty-icon {
      font-size: 40px;
      margin-bottom: 14px;
      opacity: 0.4;
    }
    
    .ov-empty p {
      font-size: 13px;
      margin: 0;
      line-height: 1.5;
    }
    
    .ov-toggle-btn {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      width: 28px;
      height: 72px;
      background: #00a884;
      border: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    
    .ov-toggle-btn:hover {
      width: 34px;
      background: #00d9a5;
    }
    
    .ov-toggle-btn svg {
      width: 16px;
      height: 16px;
      fill: white;
    }
    
    .ov-toggle-btn.sidebar-open {
      right: 340px;
    }
    
    /* Modal de recuperação */
    .ov-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(11, 20, 26, 0.85);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px);
    }
    
    .ov-modal {
      background: #111b21;
      border-radius: 12px;
      width: 90%;
      max-width: 420px;
      max-height: 75vh;
      overflow-y: auto;
      border: 1px solid #233138;
    }
    
    .ov-modal-header {
      padding: 16px;
      border-bottom: 1px solid #233138;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      background: #111b21;
    }
    
    .ov-modal-title {
      font-size: 15px;
      font-weight: 500;
      color: #e9edef;
    }
    
    .ov-modal-body {
      padding: 16px;
    }
    
    .ov-tx-info-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid #233138;
    }
    
    .ov-tx-info-row .ov-tx-name {
      max-width: none;
      flex: 1;
    }
    
    .ov-recovery-message {
      background: #1f2c33;
      border: 1px solid #233138;
      border-radius: 8px;
      padding: 14px;
      white-space: pre-wrap;
      font-size: 13px;
      color: #e9edef;
      line-height: 1.6;
      margin-bottom: 14px;
    }
    
    .ov-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
      width: 100%;
    }
    
    .ov-btn-primary {
      background: #00a884;
      color: #111b21;
    }
    
    .ov-btn-primary:hover {
      background: #00d9a5;
    }
    
    .ov-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 50px;
      color: #8696a0;
      gap: 14px;
    }
    
    .ov-spinner {
      width: 28px;
      height: 28px;
      border: 2px solid #233138;
      border-top-color: #00a884;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .ov-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #00a884;
      color: #111b21;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      z-index: 100001;
      animation: toastIn 0.25s ease;
    }
    
    @keyframes toastIn {
      from { opacity: 0; transform: translate(-50%, 16px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    
    .ov-phone-debug {
      background: #1f2c33;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 12px;
      font-size: 11px;
      color: #667781;
      font-family: monospace;
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
      <h2>
        <img src="${chrome.runtime.getURL('icon48.png')}" class="ov-logo" alt="Logo">
        Origem Viva
      </h2>
      <button class="ov-close-btn" onclick="toggleSidebar()">✕</button>
    </div>
    <div id="ov-sidebar-tabs">
      <button class="ov-tab active" data-tab="lead">Lead Atual</button>
      <button class="ov-tab" data-tab="recent">Recentes</button>
    </div>
    <div id="ov-sidebar-content">
      <div class="ov-empty">
        <div class="ov-empty-icon">💬</div>
        <p>Selecione uma conversa<br>para ver dados do lead</p>
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
    
    // Carrega lead atual se já houver um telefone detectado
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
  } else {
    renderRecentContent(content);
  }
}

function renderLeadContent(container) {
  if (!currentLeadData || !currentPhone) {
    container.innerHTML = `
      <div class="ov-empty">
        <div class="ov-empty-icon">💬</div>
        <p>Selecione uma conversa<br>para ver dados do lead</p>
      </div>
    `;
    return;
  }
  
  const { customer, transactions = [], abandoned = [] } = currentLeadData;
  const totalPaid = transactions.filter(t => t.status === 'pago').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalPending = transactions.filter(t => ['gerado', 'pendente'].includes(t.status)).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  
  const displayPhone = formatDisplayPhone(currentPhone);
  const customerName = customer?.name || transactions[0]?.customer_name || abandoned[0]?.customer_name || 'Lead';
  
  container.innerHTML = `
    <div class="ov-lead-info">
      <div class="ov-lead-name">${customerName}</div>
      <div class="ov-lead-phone">${displayPhone}</div>
      <div class="ov-lead-stats">
        <div class="ov-stat">
          <div class="ov-stat-value">${formatCurrency(totalPaid)}</div>
          <div class="ov-stat-label">Total Pago</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value pending">${formatCurrency(totalPending)}</div>
          <div class="ov-stat-label">Pendente</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value">${transactions.length}</div>
          <div class="ov-stat-label">Transações</div>
        </div>
        <div class="ov-stat">
          <div class="ov-stat-value abandoned">${abandoned.length}</div>
          <div class="ov-stat-label">Abandonos</div>
        </div>
      </div>
    </div>
    
    ${transactions.length > 0 ? `
      <div class="ov-section-title">Transações</div>
      <div class="ov-tx-list">
        ${transactions.map(tx => renderTransactionCard(tx, false)).join('')}
      </div>
    ` : ''}
    
    ${abandoned.length > 0 ? `
      <div class="ov-section-title">Abandonos</div>
      <div class="ov-tx-list">
        ${abandoned.map(ab => renderAbandonedCard(ab)).join('')}
      </div>
    ` : ''}
    
    ${transactions.length === 0 && abandoned.length === 0 ? `
      <div class="ov-empty" style="padding: 30px;">
        <p>Nenhum dado encontrado para este lead</p>
      </div>
    ` : ''}
  `;
  
  // Adiciona event listeners para cards recuperáveis
  container.querySelectorAll('.ov-tx-card[data-tx-id]').forEach(card => {
    card.addEventListener('click', () => {
      const txId = card.dataset.txId;
      const tx = transactions.find(t => t.id === txId);
      if (tx && ['gerado', 'pendente'].includes(tx.status)) {
        showRecoveryModal(tx);
      }
    });
  });
}

function renderRecentContent(container) {
  if (recentTransactions.length === 0) {
    container.innerHTML = `<div class="ov-loading"><div class="ov-spinner"></div><span>Carregando...</span></div>`;
    return;
  }
  
  container.innerHTML = `
    <div class="ov-section-title">Últimas 50 Transações</div>
    <div class="ov-tx-list">
      ${recentTransactions.map(tx => renderTransactionCard(tx, true)).join('')}
    </div>
  `;
  
  container.querySelectorAll('.ov-tx-card[data-phone]').forEach(card => {
    card.addEventListener('click', () => {
      const phone = card.dataset.phone;
      if (phone) {
        openChat(phone);
      }
    });
  });
}

function renderTransactionCard(tx, showPhone = false) {
  const statusClass = tx.status;
  const typeClass = tx.type;
  const isRecoverable = ['gerado', 'pendente'].includes(tx.status);
  
  return `
    <div class="ov-tx-card ${typeClass} ${isRecoverable ? 'recoverable' : ''}" 
         data-tx-id="${tx.id}" 
         ${showPhone && tx.customer_phone ? `data-phone="${tx.customer_phone}"` : ''}>
      <div class="ov-tx-header">
        <div class="ov-tx-name">${tx.customer_name || 'Sem nome'}</div>
        <div class="ov-tx-amount">${formatCurrency(tx.amount)}</div>
      </div>
      <div class="ov-tx-meta">
        <span class="ov-tx-badge ${statusClass}">${tx.type} · ${tx.status}</span>
        <span class="ov-tx-date">${formatDate(tx.created_at)}</span>
      </div>
    </div>
  `;
}

function renderAbandonedCard(ab) {
  return `
    <div class="ov-tx-card abandoned">
      <div class="ov-tx-header">
        <div class="ov-tx-name">${ab.customer_name || 'Sem nome'}</div>
        <div class="ov-tx-amount">${ab.amount ? formatCurrency(ab.amount) : '-'}</div>
      </div>
      <div class="ov-tx-meta">
        <span class="ov-tx-badge abandoned">${ab.event_type || 'abandono'}</span>
        <span class="ov-tx-date">${formatDate(ab.created_at)}</span>
      </div>
    </div>
  `;
}

// ========== MODAL DE RECUPERAÇÃO ==========
function showRecoveryModal(tx) {
  const message = generateRecoveryMessage(tx);
  
  const overlay = document.createElement('div');
  overlay.className = 'ov-modal-overlay';
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  
  overlay.innerHTML = `
    <div class="ov-modal">
      <div class="ov-modal-header">
        <span class="ov-modal-title">Recuperação de ${tx.type.toUpperCase()}</span>
        <button class="ov-close-btn" onclick="this.closest('.ov-modal-overlay').remove()">✕</button>
      </div>
      <div class="ov-modal-body">
        <div class="ov-tx-info-row">
          <span class="ov-tx-name">${tx.customer_name || 'Lead'}</span>
          <span class="ov-tx-badge ${tx.status}">${tx.status}</span>
          <span class="ov-tx-amount">${formatCurrency(tx.amount)}</span>
        </div>
        <div class="ov-recovery-message">${message}</div>
        <button class="ov-btn ov-btn-primary" id="ov-copy-msg">
          📋 Copiar Mensagem
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.querySelector('#ov-copy-msg').onclick = () => {
    navigator.clipboard.writeText(message);
    showToast('Mensagem copiada!');
    overlay.remove();
  };
}

function generateRecoveryMessage(tx) {
  const settings = currentLeadData?.pixCardSettings;
  const greeting = getGreeting();
  const firstName = tx.customer_name?.split(' ')[0] || 'cliente';
  const amount = formatCurrency(tx.amount);
  
  let template = settings?.message || 'Olá {primeiro_nome}! Notamos que seu pagamento de {valor} está pendente. Posso ajudar?';
  
  template = template
    .replace(/{saudação}/g, greeting)
    .replace(/{saudacao}/g, greeting)
    .replace(/{nome}/g, tx.customer_name || '')
    .replace(/{primeiro_nome}/g, firstName)
    .replace(/{valor}/g, amount);
  
  // Para boletos, adiciona código de barras se disponível
  if (tx.type === 'boleto' && tx.external_id) {
    template += `\n\n📄 Código de barras:\n${tx.external_id}`;
  }
  
  return template;
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
    
    const activeTab = document.querySelector('.ov-tab.active')?.dataset.tab;
    if (activeTab === 'recent') {
      renderContent('recent');
    }
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
      content.innerHTML = `<div class="ov-empty"><p>Erro ao carregar dados</p></div>`;
    }
  }
}

// ========== DETECÇÃO DE CONVERSA ==========
function extractPhoneFromConversation() {
  // Método 1: Tenta pegar do header da conversa (span com título)
  const headerSpans = document.querySelectorAll('header span[title], header span[dir="auto"]');
  for (const span of headerSpans) {
    const text = span.getAttribute('title') || span.textContent || '';
    const phone = extractPhoneFromText(text);
    if (phone) {
      console.log('[WhatsApp Extension] Telefone encontrado no header:', phone);
      return phone;
    }
  }
  
  // Método 2: Tenta o seletor específico do WhatsApp
  const conversationTitle = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
  if (conversationTitle) {
    const text = conversationTitle.textContent || '';
    const phone = extractPhoneFromText(text);
    if (phone) {
      console.log('[WhatsApp Extension] Telefone do título:', phone);
      return phone;
    }
  }
  
  // Método 3: Procura em qualquer elemento com data-jid
  const jidElements = document.querySelectorAll('[data-jid]');
  for (const el of jidElements) {
    const jid = el.getAttribute('data-jid');
    if (jid && jid.includes('@')) {
      const phone = jid.split('@')[0];
      if (/^\d{10,15}$/.test(phone)) {
        console.log('[WhatsApp Extension] Telefone do JID:', phone);
        return phone;
      }
    }
  }
  
  // Método 4: URL da página
  const urlMatch = window.location.href.match(/phone=(\d+)/);
  if (urlMatch) {
    console.log('[WhatsApp Extension] Telefone da URL:', urlMatch[1]);
    return urlMatch[1];
  }
  
  return null;
}

function extractPhoneFromText(text) {
  if (!text) return null;
  
  // Remove caracteres de formatação e extrai números
  const cleaned = text.replace(/[\s\-\(\)\.]/g, '');
  
  // Padrão brasileiro: +55 XX XXXXX-XXXX ou variações
  const patterns = [
    /\+?55\d{10,11}/,        // +5511999999999 ou 5511999999999
    /\d{12,13}/,              // 5511999999999 sem +
    /\+\d{10,15}/,            // Qualquer número internacional
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let phone = match[0].replace(/^\+/, '');
      return phone;
    }
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
  
  // Verifica periodicamente (mais confiável que MutationObserver para WhatsApp)
  setInterval(checkConversation, 1000);
  
  // Também observa mudanças no DOM
  const observer = new MutationObserver(() => {
    setTimeout(checkConversation, 200);
  });
  
  // Inicia observação quando o app aparecer
  const waitForApp = setInterval(() => {
    const app = document.querySelector('#app, [data-testid="chat-list"]');
    if (app) {
      clearInterval(waitForApp);
      observer.observe(document.body, { childList: true, subtree: true });
      checkConversation();
    }
  }, 500);
}

// ========== FUNÇÕES ORIGINAIS (mantidas) ==========
function waitForElement(selector, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout: ${selector}`));
        return;
      }
      
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
    if (i < lines.length - 1) {
      document.execCommand('insertLineBreak');
    }
  }
  
  element.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

async function openChat(phone) {
  const formattedPhone = formatPhone(phone);
  console.log('[WhatsApp] Abrindo chat:', formattedPhone);

  try {
    const newChatBtn = document.querySelector('[data-tab="2"]') 
      || document.querySelector('[aria-label="Nova conversa"]')
      || document.querySelector('[aria-label="New chat"]')
      || document.querySelector('span[data-icon="new-chat-outline"]')?.parentElement;
    
    if (!newChatBtn) throw new Error('Botão nova conversa não encontrado');
    newChatBtn.click();
    
    await new Promise(r => setTimeout(r, 300));

    const searchInput = await waitForElement('[data-tab="3"]', 1000);
    searchInput.focus();
    searchInput.textContent = formattedPhone;
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
    
    await new Promise(r => setTimeout(r, 500));

    const result = document.querySelector('[data-testid="cell-frame-container"]')
      || document.querySelector('._ajvq')
      || document.querySelector('[data-testid="chat-list"] [role="listitem"]');
    
    if (result) {
      result.click();
    } else {
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    }
    
    await new Promise(r => setTimeout(r, 300));
    console.log('[WhatsApp] Chat aberto');
    
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    throw error;
  }
}

async function sendText(phone, text) {
  console.log('[WhatsApp] Enviando texto para:', phone);

  await openChat(phone);
  await new Promise(r => setTimeout(r, 400));

  try {
    const messageInput = document.querySelector('[data-tab="10"]')
      || document.querySelector('[data-testid="conversation-compose-box-input"]')
      || document.querySelector('footer div[contenteditable="true"]');

    if (!messageInput) throw new Error('Campo de mensagem não encontrado');

    insertTextWithLineBreaks(messageInput, text);
    
    await new Promise(r => setTimeout(r, 200));
    console.log('[WhatsApp] Mensagem preparada');
    
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    throw error;
  }
}

async function sendImage(phone, imageUrl) {
  console.log('[WhatsApp] Preparando imagem para:', phone);
  await openChat(phone);
  console.log('[WhatsApp] Chat aberto - arraste a imagem para enviar');
}

// ========== INICIALIZAÇÃO ==========
function init() {
  console.log('[WhatsApp Extension] Inicializando dashboard...');
  injectStyles();
  createSidebar();
  createToggleButton();
  observeConversationChanges();
}

// Escuta comandos do background (original)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WhatsApp Extension] Recebeu comando:', message.type);

  if (message.type === 'OPEN_CHAT') {
    openChat(message.phone)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SEND_TEXT') {
    sendText(message.phone, message.text)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SEND_IMAGE') {
    sendImage(message.phone, message.imageUrl)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});

// Verifica periodicamente se ainda está na página
setInterval(() => {
  if (document.visibilityState === 'visible') {
    chrome.runtime.sendMessage({ type: 'WHATSAPP_READY' });
  }
}, 5000);

// Aguarda DOM estar pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
