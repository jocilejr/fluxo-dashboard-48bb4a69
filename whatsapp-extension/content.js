// Origem Viva WhatsApp Extension v2.0.0
// Design Minimalista Escuro Profissional

const CONFIG = {
  VERSION: '2.0.0',
  API_URL: 'https://suaznqybxvborpkrtdpm.supabase.co',
  API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1YXpucXlieHZib3Jwa3J0ZHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODk5MjgsImV4cCI6MjA4MDI2NTkyOH0.2NXt5eOqM6wCTmlNFpP5H8VxLdVBuarFUwphWbq9kQA',
  LOGO_URL: 'https://d89d7fe0-aec2-4559-ab78-93b0f65c21d2.lovableproject.com/logo-ov.png'
};

let currentPhone = null;
let currentData = null;
let currentTab = 'lead';

// ========== UTILIDADES ==========

function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length > 11) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

function generatePhoneVariations(phone) {
  if (!phone) return [];
  const cleaned = phone.replace(/\D/g, '');
  const variations = new Set();
  
  // Adiciona o número original
  variations.add(cleaned);
  
  // Remove ou adiciona 55
  if (cleaned.startsWith('55')) {
    variations.add(cleaned.substring(2));
  } else {
    variations.add('55' + cleaned);
  }
  
  // Variações com/sem nono dígito
  const base = cleaned.startsWith('55') ? cleaned.substring(2) : cleaned;
  if (base.length === 11) {
    // Remove nono dígito
    const ddd = base.substring(0, 2);
    const number = base.substring(3);
    variations.add(ddd + number);
    variations.add('55' + ddd + number);
  } else if (base.length === 10) {
    // Adiciona nono dígito
    const ddd = base.substring(0, 2);
    const number = base.substring(2);
    variations.add(ddd + '9' + number);
    variations.add('55' + ddd + '9' + number);
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
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
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

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado!');
    return true;
  } catch (e) {
    console.error('Erro ao copiar:', e);
    return false;
  }
}

// ========== EXTRAÇÃO DE TELEFONE ==========

function extractPhoneFromChat() {
  // Método 1: Header da conversa
  const headerSpan = document.querySelector('header span[title]');
  if (headerSpan) {
    const title = headerSpan.getAttribute('title');
    if (title) {
      const phone = title.replace(/\D/g, '');
      if (phone.length >= 10) return phone;
    }
  }
  
  // Método 2: Contato selecionado
  const selectedChat = document.querySelector('[data-testid="cell-frame-container"][aria-selected="true"]');
  if (selectedChat) {
    const chatTitle = selectedChat.querySelector('span[title]');
    if (chatTitle) {
      const phone = chatTitle.getAttribute('title').replace(/\D/g, '');
      if (phone.length >= 10) return phone;
    }
  }
  
  // Método 3: URL do WhatsApp
  const match = window.location.href.match(/\/(\d{10,15})/);
  if (match) return match[1];
  
  return null;
}

// ========== API SUPABASE ==========

async function fetchLeadData(phone) {
  if (!phone) return null;
  
  const variations = generatePhoneVariations(phone);
  console.log('[OV] Buscando variações:', variations);
  
  try {
    // Busca transações
    const orFilter = variations.map(v => `normalized_phone.eq.${v}`).join(',');
    
    const transactionsRes = await fetch(
      `${CONFIG.API_URL}/rest/v1/transactions?or=(${orFilter})&order=created_at.desc&limit=50`,
      {
        headers: {
          'apikey': CONFIG.API_KEY,
          'Authorization': `Bearer ${CONFIG.API_KEY}`
        }
      }
    );
    const transactions = await transactionsRes.json();
    
    // Busca eventos abandonados
    const abandonedRes = await fetch(
      `${CONFIG.API_URL}/rest/v1/abandoned_events?or=(${orFilter})&order=created_at.desc&limit=20`,
      {
        headers: {
          'apikey': CONFIG.API_KEY,
          'Authorization': `Bearer ${CONFIG.API_KEY}`
        }
      }
    );
    const abandoned = await abandonedRes.json();
    
    // Busca links úteis
    const linksRes = await fetch(
      `${CONFIG.API_URL}/rest/v1/useful_links?is_active=eq.true&order=sort_order.asc`,
      {
        headers: {
          'apikey': CONFIG.API_KEY,
          'Authorization': `Bearer ${CONFIG.API_KEY}`
        }
      }
    );
    const links = await linksRes.json();
    
    // Calcula estatísticas
    const stats = {
      totalPaid: 0,
      totalPending: 0,
      transactionCount: transactions.length,
      abandonedCount: abandoned.length
    };
    
    transactions.forEach(t => {
      if (t.status === 'pago') {
        stats.totalPaid += t.amount || 0;
      } else {
        stats.totalPending += t.amount || 0;
      }
    });
    
    // Pega nome do cliente
    const customerName = transactions[0]?.customer_name || abandoned[0]?.customer_name || 'Lead';
    
    return {
      phone,
      name: customerName,
      transactions: Array.isArray(transactions) ? transactions : [],
      abandoned: Array.isArray(abandoned) ? abandoned : [],
      links: Array.isArray(links) ? links : [],
      stats
    };
  } catch (error) {
    console.error('[OV] Erro ao buscar dados:', error);
    return null;
  }
}

// ========== RENDERIZAÇÃO ==========

function createSidebar() {
  const existing = document.getElementById('ov-sidebar');
  if (existing) existing.remove();
  
  const sidebar = document.createElement('div');
  sidebar.id = 'ov-sidebar';
  sidebar.innerHTML = `
    <div class="ov-header">
      <img src="${CONFIG.LOGO_URL}" alt="OV" class="ov-logo" onerror="this.style.display='none'">
      <span class="ov-header-title">Origem Viva</span>
      <span class="ov-header-version">v${CONFIG.VERSION}</span>
    </div>
    <div class="ov-tabs">
      <button class="ov-tab active" data-tab="lead">Lead Atual</button>
      <button class="ov-tab" data-tab="transactions">Transações</button>
      <button class="ov-tab" data-tab="links">Links</button>
    </div>
    <div class="ov-content" id="ov-content">
      <div class="ov-loading"><div class="ov-spinner"></div></div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  // Event listeners para tabs
  sidebar.querySelectorAll('.ov-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      sidebar.querySelectorAll('.ov-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderContent();
    });
  });
  
  return sidebar;
}

function renderContent() {
  const content = document.getElementById('ov-content');
  if (!content) return;
  
  if (!currentData) {
    content.innerHTML = `
      <div class="ov-empty">
        <div class="ov-empty-icon">💬</div>
        <div class="ov-empty-text">Abra uma conversa para ver os dados do lead</div>
      </div>
    `;
    return;
  }
  
  switch (currentTab) {
    case 'lead':
      renderLeadTab(content);
      break;
    case 'transactions':
      renderTransactionsTab(content);
      break;
    case 'links':
      renderLinksTab(content);
      break;
  }
}

function renderLeadTab(container) {
  const { name, phone, stats, transactions, abandoned } = currentData;
  const initial = (name || 'L').charAt(0).toUpperCase();
  
  // Últimas transações (3)
  const recentTransactions = transactions.slice(0, 3);
  const recentAbandoned = abandoned.slice(0, 2);
  
  container.innerHTML = `
    <div class="ov-lead-card">
      <div class="ov-lead-header">
        <div class="ov-lead-avatar">${initial}</div>
        <div class="ov-lead-info">
          <div class="ov-lead-name">${name || 'Lead'}</div>
          <div class="ov-lead-phone">${phone || '-'}</div>
        </div>
      </div>
      <div class="ov-stats-grid">
        <div class="ov-stat-item">
          <div class="ov-stat-value success">${formatCurrency(stats.totalPaid)}</div>
          <div class="ov-stat-label">Total Pago</div>
        </div>
        <div class="ov-stat-item">
          <div class="ov-stat-value warning">${formatCurrency(stats.totalPending)}</div>
          <div class="ov-stat-label">Pendente</div>
        </div>
        <div class="ov-stat-item">
          <div class="ov-stat-value">${stats.transactionCount}</div>
          <div class="ov-stat-label">Transações</div>
        </div>
        <div class="ov-stat-item">
          <div class="ov-stat-value danger">${stats.abandonedCount}</div>
          <div class="ov-stat-label">Abandonos</div>
        </div>
      </div>
    </div>
    
    ${recentTransactions.length > 0 ? `
      <div class="ov-section">
        <div class="ov-section-title">Últimas Transações</div>
        <div class="ov-transaction-list">
          ${recentTransactions.map(t => renderTransactionCard(t)).join('')}
        </div>
      </div>
    ` : ''}
    
    ${recentAbandoned.length > 0 ? `
      <div class="ov-section">
        <div class="ov-section-title">Eventos Abandonados</div>
        <div class="ov-transaction-list">
          ${recentAbandoned.map(a => renderAbandonedCard(a)).join('')}
        </div>
      </div>
    ` : ''}
  `;
  
  // Event listeners para ações
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleAction);
  });
}

function renderTransactionsTab(container) {
  const { transactions, abandoned } = currentData;
  
  container.innerHTML = `
    <div class="ov-section">
      <div class="ov-section-title">Todas as Transações (${transactions.length})</div>
      <div class="ov-transaction-list">
        ${transactions.length > 0 
          ? transactions.map(t => renderTransactionCard(t)).join('')
          : '<div class="ov-empty"><div class="ov-empty-text">Nenhuma transação encontrada</div></div>'
        }
      </div>
    </div>
    
    <div class="ov-section">
      <div class="ov-section-title">Eventos Abandonados (${abandoned.length})</div>
      <div class="ov-transaction-list">
        ${abandoned.length > 0 
          ? abandoned.map(a => renderAbandonedCard(a)).join('')
          : '<div class="ov-empty"><div class="ov-empty-text">Nenhum evento abandonado</div></div>'
        }
      </div>
    </div>
  `;
  
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleAction);
  });
}

function renderLinksTab(container) {
  const { links } = currentData;
  
  container.innerHTML = `
    <div class="ov-section">
      <div class="ov-section-title">Links Úteis</div>
      <div class="ov-links-list">
        ${links.length > 0 
          ? links.map(link => `
            <div class="ov-link-item" data-url="${link.url}">
              <div class="ov-link-icon">${link.icon || '🔗'}</div>
              <div class="ov-link-info">
                <div class="ov-link-title">${link.title}</div>
                ${link.description ? `<div class="ov-link-desc">${link.description}</div>` : ''}
              </div>
            </div>
          `).join('')
          : '<div class="ov-empty"><div class="ov-empty-text">Nenhum link configurado</div></div>'
        }
      </div>
    </div>
  `;
  
  container.querySelectorAll('.ov-link-item').forEach(item => {
    item.addEventListener('click', () => {
      window.open(item.dataset.url, '_blank');
    });
  });
}

function renderTransactionCard(t) {
  return `
    <div class="ov-transaction-item" data-id="${t.id}">
      <div class="ov-transaction-header">
        <span class="ov-transaction-type ${t.type}">${t.type.toUpperCase()}</span>
        <span class="ov-transaction-amount">${formatCurrency(t.amount)}</span>
      </div>
      <div class="ov-transaction-header">
        <span class="ov-transaction-status ${t.status}">${t.status}</span>
        <span class="ov-transaction-date">${formatDate(t.created_at)}</span>
      </div>
      ${t.status !== 'pago' ? `
        <div class="ov-actions">
          <button class="ov-btn ov-btn-primary" data-action="recover" data-type="${t.type}" data-id="${t.id}">
            📱 Recuperar
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAbandonedCard(a) {
  return `
    <div class="ov-abandoned-item" data-id="${a.id}">
      <div class="ov-abandoned-header">
        <span class="ov-abandoned-type">${a.event_type}</span>
        <span class="ov-transaction-amount">${formatCurrency(a.amount)}</span>
      </div>
      <div class="ov-transaction-date">${formatDate(a.created_at)}</div>
      ${a.error_message ? `<div class="ov-abandoned-error">${a.error_message}</div>` : ''}
      <div class="ov-actions">
        <button class="ov-btn ov-btn-primary" data-action="recover-abandoned" data-id="${a.id}">
          📱 Recuperar
        </button>
      </div>
    </div>
  `;
}

// ========== AÇÕES ==========

async function handleAction(e) {
  const action = e.currentTarget.dataset.action;
  const id = e.currentTarget.dataset.id;
  const type = e.currentTarget.dataset.type;
  
  if (action === 'recover') {
    await recoverTransaction(id, type);
  } else if (action === 'recover-abandoned') {
    await recoverAbandoned(id);
  }
}

async function recoverTransaction(id, type) {
  const transaction = currentData.transactions.find(t => t.id === id);
  if (!transaction) return;
  
  const name = transaction.customer_name || currentData.name || 'Cliente';
  const firstName = name.split(' ')[0];
  const amount = formatCurrency(transaction.amount);
  const greeting = getGreeting();
  
  let message = '';
  
  if (type === 'boleto') {
    message = `${greeting}, ${firstName}! Tudo bem?\n\nVi que seu boleto no valor de ${amount} ainda está pendente. Posso ajudar com alguma dúvida?\n\nQualquer coisa, estou por aqui! 😊`;
  } else if (type === 'pix') {
    message = `${greeting}, ${firstName}!\n\nVi que o pagamento via PIX de ${amount} está pendente. Precisa de ajuda?\n\nEstou à disposição! 😊`;
  } else {
    message = `${greeting}, ${firstName}!\n\nVi que há um pagamento pendente de ${amount}. Posso ajudar?\n\nQualquer dúvida, é só chamar! 😊`;
  }
  
  await copyToClipboard(message);
  showToast('Mensagem copiada! Cole na conversa.');
}

async function recoverAbandoned(id) {
  const event = currentData.abandoned.find(a => a.id === id);
  if (!event) return;
  
  const name = event.customer_name || currentData.name || 'Cliente';
  const firstName = name.split(' ')[0];
  const amount = event.amount ? formatCurrency(event.amount) : '';
  const greeting = getGreeting();
  
  let message = `${greeting}, ${firstName}!\n\nVi que você estava interessado(a) em nosso produto${amount ? ` (${amount})` : ''}.\n\nPosso ajudar com alguma dúvida? 😊`;
  
  await copyToClipboard(message);
  showToast('Mensagem copiada! Cole na conversa.');
}

// ========== DETECÇÃO DE CONVERSA ==========

let lastPhone = null;

async function checkConversation() {
  const phone = extractPhoneFromChat();
  
  if (phone && phone !== lastPhone) {
    lastPhone = phone;
    currentPhone = phone;
    
    // Mostra loading
    const content = document.getElementById('ov-content');
    if (content) {
      content.innerHTML = '<div class="ov-loading"><div class="ov-spinner"></div></div>';
    }
    
    // Busca dados
    const data = await fetchLeadData(phone);
    if (data) {
      currentData = data;
      console.log('[OV] Dados do lead:', data);
    } else {
      currentData = {
        phone,
        name: 'Lead',
        transactions: [],
        abandoned: [],
        links: [],
        stats: { totalPaid: 0, totalPending: 0, transactionCount: 0, abandonedCount: 0 }
      };
    }
    
    renderContent();
  }
}

// ========== INICIALIZAÇÃO ==========

function init() {
  console.log(`[OV] Origem Viva Extension v${CONFIG.VERSION}`);
  
  // Aguarda o WhatsApp carregar
  const checkWhatsApp = setInterval(() => {
    const app = document.getElementById('app');
    if (app) {
      clearInterval(checkWhatsApp);
      
      // Cria sidebar
      createSidebar();
      
      // Verifica conversa a cada 1 segundo
      setInterval(checkConversation, 1000);
      
      console.log('[OV] Extensão inicializada!');
    }
  }, 500);
}

// Inicia quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
