// ==========================================
// 設定（後で更新）
// ==========================================

const CONFIG = {
  LIFF_ID: '2008551240-vWN36gzR',  // ⭐ 既存のLIFF IDを一時的に使用
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbyXXXXXXXXXXXXXX/exec'  // ⭐ あなたのGAS URL
};

// ==========================================
// グローバル変数
// ==========================================

let allTemplates = [];
let recentTemplates = [];
let currentCategory = 'recent';

// ==========================================
// LIFF初期化
// ==========================================

window.addEventListener('load', () => {
  console.log('🚀 Template app loaded');
  
  liff.init({
    liffId: CONFIG.LIFF_ID
  })
  .then(() => {
    console.log('✅ LIFF initialized');
    loadTemplates();
    setupEventListeners();
  })
  .catch(err => {
    console.error('❌ LIFF init error:', err);
    showError('LIFFの初期化に失敗しました');
  });
});

// ==========================================
// テンプレート読み込み
// ==========================================

async function loadTemplates() {
  try {
    const response = await fetch(`${CONFIG.GAS_API_URL}?action=getTemplates`);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.templates) {
      allTemplates = data.templates;
      console.log(`✅ Loaded ${allTemplates.length} templates`);
      
      loadRecentTemplates();
      renderTemplates();
    } else {
      throw new Error(data.error || 'テンプレート取得失敗');
    }
  } catch (error) {
    console.error('❌ Load error:', error);
    showError('テンプレートの読み込みに失敗しました');
  }
}

// ==========================================
// 最近使用管理
// ==========================================

function loadRecentTemplates() {
  const stored = localStorage.getItem('recentTemplates');
  
  if (stored) {
    try {
      const recentIds = JSON.parse(stored);
      recentTemplates = recentIds
        .map(id => allTemplates.find(t => t.id === id))
        .filter(t => t !== undefined);
      
      console.log(`✅ Loaded ${recentTemplates.length} recent templates`);
    } catch (e) {
      console.error('❌ Parse recent error:', e);
    }
  }
}

function addToRecent(templateId) {
  let recentIds = [];
  const stored = localStorage.getItem('recentTemplates');
  
  if (stored) {
    try {
      recentIds = JSON.parse(stored);
    } catch (e) {
      console.error('❌ Parse error:', e);
    }
  }
  
  recentIds = recentIds.filter(id => id !== templateId);
  recentIds.unshift(templateId);
  recentIds = recentIds.slice(0, 10);
  
  localStorage.setItem('recentTemplates', JSON.stringify(recentIds));
}

// ==========================================
// 描画
// ==========================================

function renderTemplates() {
  const container = document.getElementById('templateList');
  
  let templates = [];
  
  if (currentCategory === 'recent') {
    templates = recentTemplates;
  } else if (currentCategory === 'home') {
    renderHomeView(container);
    return;
  } else {
    templates = allTemplates.filter(t => t.category === currentCategory);
  }
  
  if (templates.length === 0) {
    showEmpty();
    return;
  }
  
  container.innerHTML = templates.map(template => `
    <div class="template-card" data-id="${template.id}">
      <div class="template-label">${escapeHtml(template.displayLabel)}</div>
      <div class="template-message">${escapeHtml(template.message)}</div>
    </div>
  `).join('');
  
  attachCardListeners();
}

function renderHomeView(container) {
  const categories = [
    { key: 'work', label: '💼 仕事' },
    { key: 'study', label: '📚 勉強' },
    { key: 'life', label: '🏡 生活' },
    { key: 'play', label: '🎉 遊び' },
    { key: 'communication', label: '💬 コミュニケーション' }
  ];
  
  let html = '';
  
  categories.forEach(cat => {
    const templates = allTemplates.filter(t => t.category === cat.key);
    
    if (templates.length > 0) {
      html += `<div class="category-title">${cat.label}</div>`;
      
      templates.forEach(template => {
        html += `
          <div class="template-card" data-id="${template.id}">
            <div class="template-label">${escapeHtml(template.displayLabel)}</div>
            <div class="template-message">${escapeHtml(template.message)}</div>
          </div>
        `;
      });
    }
  });
  
  container.innerHTML = html;
  attachCardListeners();
}

function attachCardListeners() {
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      sendTemplate(card.dataset.id);
    });
  });
}

// ==========================================
// 送信
// ==========================================

function sendTemplate(templateId) {
  const template = allTemplates.find(t => t.id === templateId);
  
  if (!template) {
    console.error('❌ Template not found:', templateId);
    return;
  }
  
  liff.sendMessages([{
    type: 'text',
    text: template.message
  }])
  .then(() => {
    console.log('✅ Sent:', templateId);
    addToRecent(templateId);
    liff.closeWindow();
  })
  .catch(err => {
    console.error('❌ Send error:', err);
    alert('送信に失敗しました');
  });
}

// ==========================================
// イベント
// ==========================================

function setupEventListeners() {
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      currentCategory = tab.dataset.category;
      renderTemplates();
    });
  });
}

// ==========================================
// ユーティリティ
// ==========================================

function showError(message) {
  document.getElementById('templateList').innerHTML = 
    `<div class="error">${escapeHtml(message)}</div>`;
}

function showEmpty() {
  const container = document.getElementById('templateList');
  const msg = currentCategory === 'recent' 
    ? 'まだ使用したテンプレートがありません' 
    : 'このカテゴリにテンプレートがありません';
  container.innerHTML = `<div class="empty">${msg}</div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}