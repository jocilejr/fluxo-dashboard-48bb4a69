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
      width: 380px;
      height: 100vh;
      background: #111827;
      border-left: 1px solid #374151;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: transform 0.3s ease;
      box-shadow: -4px 0 20px rgba(0,0,0,0.3);
    }
    
    #ov-sidebar.hidden {
      transform: translateX(100%);
    }
    
    #ov-sidebar-header {
      padding: 16px;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      border-bottom: 1px solid #374151;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    #ov-sidebar-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #f9fafb;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    #ov-sidebar-header h2::before {
      content: '';
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .ov-close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px;
      font-size: 20px;
      line-height: 1;
    }
    
    .ov-close-btn:hover {
      color: #f9fafb;
    }
    
    #ov-sidebar-tabs {
      display: flex;
      border-bottom: 1px solid #374151;
      background: #1f2937;
    }
    
    .ov-tab {
      flex: 1;
      padding: 12px;
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    
    .ov-tab.active {
      color: #10b981;
      border-bottom-color: #10b981;
      background: rgba(16, 185, 129, 0.1);
    }
    
    .ov-tab:hover:not(.active) {
      color: #f9fafb;
      background: rgba(255,255,255,0.05);
    }
    
    #ov-sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    
    .ov-lead-info {
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .ov-lead-name {
      font-size: 18px;
      font-weight: 600;
      color: #f9fafb;
      margin-bottom: 4px;
    }
    
    .ov-lead-phone {
      font-size: 13px;
      color: #9ca3af;
      margin-bottom: 12px;
    }
    
    .ov-lead-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    
    .ov-stat {
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    
    .ov-stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #10b981;
    }
    
    .ov-stat-value.pending {
      color: #f59e0b;
    }
    
    .ov-stat-value.abandoned {
      color: #ef4444;
    }
    
    .ov-stat-label {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 2px;
    }
    
    .ov-section-title {
      font-size: 12px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .ov-tx-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .ov-tx-card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .ov-tx-card:hover {
      border-color: #10b981;
      transform: translateY(-1px);
    }
    
    .ov-tx-card.boleto {
      border-left: 3px solid #f59e0b;
    }
    
    .ov-tx-card.pix {
      border-left: 3px solid #10b981;
    }
    
    .ov-tx-card.cartao {
      border-left: 3px solid #8b5cf6;
    }
    
    .ov-tx-card.abandoned {
      border-left: 3px solid #ef4444;
    }
    
    .ov-tx-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    
    .ov-tx-name {
      font-size: 14px;
      font-weight: 500;
      color: #f9fafb;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .ov-tx-amount {
      font-size: 14px;
      font-weight: 700;
      color: #10b981;
    }
    
    .ov-tx-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .ov-tx-type {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .ov-tx-type.gerado { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .ov-tx-type.pendente { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .ov-tx-type.pago { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .ov-tx-type.cancelado { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .ov-tx-type.expirado { background: rgba(156, 163, 175, 0.2); color: #9ca3af; }
    .ov-tx-type.abandoned { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    
    .ov-tx-date {
      font-size: 11px;
      color: #6b7280;
    }
    
    .ov-empty {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }
    
    .ov-empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }
    
    .ov-toggle-btn {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      width: 32px;
      height: 80px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: -2px 0 10px rgba(0,0,0,0.3);
      transition: all 0.2s;
    }
    
    .ov-toggle-btn:hover {
      width: 40px;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
    }
    
    .ov-toggle-btn svg {
      width: 20px;
      height: 20px;
      fill: white;
    }
    
    .ov-toggle-btn.sidebar-open {
      right: 380px;
    }
    
    /* Modal de recuperação */
    .ov-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .ov-modal {
      background: #1f2937;
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    
    .ov-modal-header {
      padding: 20px;
      border-bottom: 1px solid #374151;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .ov-modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #f9fafb;
    }
    
    .ov-modal-body {
      padding: 20px;
    }
    
    .ov-recovery-message {
      background: #111827;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      white-space: pre-wrap;
      font-size: 14px;
      color: #e5e7eb;
      line-height: 1.6;
    }
    
    .ov-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    
    .ov-btn-primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }
    
    .ov-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    
    .ov-btn-secondary {
      background: #374151;
      color: #f9fafb;
    }
    
    .ov-btn-secondary:hover {
      background: #4b5563;
    }
    
    .ov-btn-group {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }
    
    .ov-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: #9ca3af;
    }
    
    .ov-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #374151;
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 12px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .ov-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      z-index: 100001;
      animation: slideUp 0.3s ease;
    }
    
    @keyframes slideUp {
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
      <h2>Origem Viva</h2>
      <button class="ov-close-btn" onclick="toggleSidebar()">×</button>
    </div>
    <div id="ov-sidebar-tabs">
      <button class="ov-tab active" data-tab="lead">Lead Atual</button>
      <button class="ov-tab" data-tab="recent">Recentes</button>
    </div>
    <div id="ov-sidebar-content">
      <div class="ov-empty">
        <div class="ov-empty-icon">📱</div>
        <p>Abra uma conversa para ver informações do lead</p>
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
  if (!currentLeadData) {
    container.innerHTML = `
      <div class="ov-empty">
        <div class="ov-empty-icon">📱</div>
        <p>Abra uma conversa para ver informações do lead</p>
      </div>
    `;
    return;
  }
  
  const { customer, transactions, abandoned } = currentLeadData;
  const totalPaid = transactions.filter(t => t.status === 'pago').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalPending = transactions.filter(t => ['gerado', 'pendente'].includes(t.status)).reduce((sum, t) => sum + Number(t.amount), 0);
  
  container.innerHTML = `
    <div class="ov-lead-info">
      <div class="ov-lead-name">${customer?.name || 'Lead sem nome'}</div>
      <div class="ov-lead-phone">${currentPhone}</div>
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
      <div class="ov-section-title">📊 Transações</div>
      <div class="ov-tx-list">
        ${transactions.map(tx => renderTransactionCard(tx, false)).join('')}
      </div>
    ` : ''}
    
    ${abandoned.length > 0 ? `
      <div class="ov-section-title" style="margin-top: 16px;">⚠️ Abandonos</div>
      <div class="ov-tx-list">
        ${abandoned.map(ab => renderAbandonedCard(ab)).join('')}
      </div>
    ` : ''}
  `;
  
  // Adiciona event listeners
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
    container.innerHTML = `<div class="ov-loading"><div class="ov-spinner"></div>Carregando...</div>`;
    return;
  }
  
  container.innerHTML = `
    <div class="ov-section-title">📋 Transações Recentes</div>
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
    <div class="ov-tx-card ${typeClass}" data-tx-id="${tx.id}" ${showPhone && tx.customer_phone ? `data-phone="${tx.customer_phone}"` : ''} style="${isRecoverable ? 'cursor: pointer' : ''}">
      <div class="ov-tx-header">
        <div class="ov-tx-name">${tx.customer_name || 'Sem nome'}</div>
        <div class="ov-tx-amount">${formatCurrency(tx.amount)}</div>
      </div>
      <div class="ov-tx-meta">
        <span class="ov-tx-type ${statusClass}">${tx.type} • ${tx.status}</span>
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
        <span class="ov-tx-type abandoned">${ab.event_type}</span>
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
        <span class="ov-modal-title">💬 Recuperação de ${tx.type.toUpperCase()}</span>
        <button class="ov-close-btn" onclick="this.closest('.ov-modal-overlay').remove()">×</button>
      </div>
      <div class="ov-modal-body">
        <div style="margin-bottom: 12px; color: #9ca3af; font-size: 13px;">
          ${tx.customer_name || 'Lead'} • ${formatCurrency(tx.amount)} • ${tx.status}
        </div>
        <div class="ov-recovery-message">${message}</div>
        <div class="ov-btn-group">
          <button class="ov-btn ov-btn-primary" id="ov-copy-msg">
            📋 Copiar Mensagem
          </button>
        </div>
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
  
  setTimeout(() => toast.remove(), 3000);
}

// ========== UTILIDADES ==========
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    content.innerHTML = `<div class="ov-loading"><div class="ov-spinner"></div>Carregando...</div>`;
  }
  
  try {
    const response = await fetch(`${API_URL}?action=lead&phone=${encodeURIComponent(phone)}`);
    currentLeadData = await response.json();
    
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
  // Tenta extrair o telefone do header da conversa
  const headerEl = document.querySelector('[data-testid="conversation-header"]') 
    || document.querySelector('header._amid');
  
  if (!headerEl) return null;
  
  // Procura o título com o nome/número
  const titleEl = headerEl.querySelector('[data-testid="conversation-info-header-chat-title"]')
    || headerEl.querySelector('._amig span')
    || headerEl.querySelector('span[title]');
  
  if (!titleEl) return null;
  
  const text = titleEl.textContent || titleEl.getAttribute('title') || '';
  
  // Se for um número de telefone
  const phoneMatch = text.match(/[\d\s\-\+\(\)]{10,}/);
  if (phoneMatch) {
    return phoneMatch[0].replace(/\D/g, '');
  }
  
  // Se for um nome, tenta pegar do data-jid ou outro atributo
  const chatEl = document.querySelector('[data-testid="conversation-panel-wrapper"]');
  const jid = chatEl?.querySelector('[data-jid]')?.getAttribute('data-jid');
  if (jid) {
    const phone = jid.split('@')[0];
    if (/^\d+$/.test(phone)) return phone;
  }
  
  return null;
}

function observeConversationChanges() {
  let lastConversationPhone = null;
  
  const checkConversation = () => {
    const phone = extractPhoneFromConversation();
    
    if (phone && phone !== lastConversationPhone) {
      lastConversationPhone = phone;
      currentPhone = phone;
      
      if (sidebarVisible) {
        loadLeadData(phone);
      }
    }
  };
  
  // Observa mudanças no DOM para detectar troca de conversa
  const observer = new MutationObserver(() => {
    checkConversation();
  });
  
  // Inicia observação quando o main aparecer
  const waitForMain = setInterval(() => {
    const main = document.querySelector('#main') || document.querySelector('[data-testid="conversation-panel-wrapper"]');
    if (main) {
      clearInterval(waitForMain);
      observer.observe(main, { childList: true, subtree: true });
      checkConversation();
    }
  }, 1000);
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
  setTimeout(init, 2000); // Aguarda WhatsApp carregar
}
