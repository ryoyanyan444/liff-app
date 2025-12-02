// ========================================
// 設定
// ========================================
const LIFF_ID = '2008551240-W6log3Gr';
const API_URL = 'https://api.ai-chat-jp.com/api';

let userId = null;

// ========================================
// カテゴリデータ
// ========================================
const categories = {
    work: {
        name: '仕事のトラブル',
        icon: '🏢',
        middle: [
            {
                id: 'salary',
                icon: '💸',
                name: '給料の問題',
                items: [
                    { id: 'no_salary', label: '給料がもらえない' },
                    { id: 'low_salary', label: '給料が約束より少ない' },
                    { id: 'no_payslip', label: '給料明細がもらえない' }
                ]
            },
            {
                id: 'overtime',
                icon: '⏰',
                name: '残業・休日の問題',
                items: [
                    { id: 'no_overtime_pay', label: '残業代が出ない' },
                    { id: 'no_holiday', label: '休みが取れない' },
                    { id: 'forced_work', label: '休日出勤を強制される' }
                ]
            },
            {
                id: 'harassment',
                icon: '👨‍💼',
                name: '上司・同僚とのトラブル',
                items: [
                    { id: 'power_harassment', label: 'パワハラ・いじめ' },
                    { id: 'sexual_harassment', label: 'セクハラ' },
                    { id: 'violence', label: '暴力・暴言' }
                ]
            },
            {
                id: 'contract',
                icon: '📄',
                name: '契約の問題',
                items: [
                    { id: 'different_work', label: '契約と違う仕事をさせられる' },
                    { id: 'no_contract', label: '契約書がもらえない' },
                    { id: 'not_understand', label: '契約内容が理解できない' }
                ]
            },
            {
                id: 'dismissal',
                icon: '🚪',
                name: '解雇・退職',
                items: [
                    { id: 'fired', label: 'クビになった' },
                    { id: 'cant_quit', label: '辞めさせてもらえない' },
                    { id: 'no_severance', label: '退職金がもらえない' }
                ]
            },
            {
                id: 'dormitory',
                icon: '🏠',
                name: '寮・住まいの問題',
                items: [
                    { id: 'high_rent', label: '寮費が高すぎる' },
                    { id: 'bad_condition', label: '寮の環境が悪い' },
                    { id: 'evicted', label: '寮を追い出された' }
                ]
            }
        ]
    },
    money: {
        name: 'お金の悩み',
        icon: '💰',
        middle: [
            {
                id: 'tax',
                icon: '💴',
                name: '税金',
                items: [
                    { id: 'high_tax', label: '税金が高すぎる' },
                    { id: 'how_to_pay', label: '税金の払い方がわからない' },
                    { id: 'tax_return', label: '確定申告のやり方' }
                ]
            },
            {
                id: 'pension',
                icon: '📋',
                name: '年金・保険',
                items: [
                    { id: 'dont_want_pension', label: '年金を払いたくない' },
                    { id: 'high_insurance', label: '国民健康保険が高い' },
                    { id: 'how_to_use', label: '保険の使い方がわからない' }
                ]
            },
            {
                id: 'debt',
                icon: '💳',
                name: '借金・ローン',
                items: [
                    { id: 'cant_repay', label: '借金が返せない' },
                    { id: 'credit_trouble', label: 'クレジットカードのトラブル' },
                    { id: 'scam', label: '怪しい勧誘を受けた' }
                ]
            },
            {
                id: 'remittance',
                icon: '🌍',
                name: '送金・仕送り',
                items: [
                    { id: 'how_to_send', label: '送金方法がわからない' },
                    { id: 'high_fee', label: '送金手数料が高い' },
                    { id: 'family_support', label: '家族への仕送りが大変' }
                ]
            },
            {
                id: 'living_cost',
                icon: '💸',
                name: '生活費・節約',
                items: [
                    { id: 'no_money', label: 'お金が足りない' },
                    { id: 'how_to_save', label: '節約の方法を知りたい' },
                    { id: 'subsidy', label: '給付金・支援制度を知りたい' }
                ]
            }
        ]
    },
    health: {
        name: '病気・ケガ・健康',
        icon: '🏥',
        middle: [
            {
                id: 'hospital',
                icon: '🏥',
                name: '病院に行きたい・探したい',
                items: [
                    { id: 'find_hospital', label: '病院の探し方がわからない' },
                    { id: 'what_dept', label: '何科に行けばいいかわからない' },
                    { id: 'how_to_reserve', label: '予約の取り方がわからない' },
                    { id: 'vietnamese', label: 'ベトナム語で相談したい' }
                ]
            },
            {
                id: 'language',
                icon: '🗣️',
                name: '言葉が通じない・不安',
                items: [
                    { id: 'interpreter', label: '医療通訳サービスを使いたい' },
                    { id: 'translation', label: '翻訳アプリ・問診票を知りたい' },
                    { id: 'foreigner_hospital', label: '外国人向けの病院を探したい' }
                ]
            },
            {
                id: 'medicine',
                icon: '💊',
                name: '薬・治療',
                items: [
                    { id: 'how_to_take', label: '薬の飲み方がわからない' },
                    { id: 'prescription', label: '処方箋の見方がわからない' },
                    { id: 'expensive_medicine', label: '薬代が高い' }
                ]
            },
            {
                id: 'medical_cost',
                icon: '💰',
                name: '医療費・保険',
                items: [
                    { id: 'cant_pay', label: '病院代が払えない' },
                    { id: 'no_insurance', label: '保険証がない・使い方がわからない' },
                    { id: 'expensive', label: '医療費が高すぎる' }
                ]
            },
            {
                id: 'mental',
                icon: '😔',
                name: 'メンタルヘルス',
                items: [
                    { id: 'lonely', label: '孤独・寂しい' },
                    { id: 'stress', label: 'ストレス・うつ' },
                    { id: 'no_one_to_talk', label: '誰にも相談できない' }
                ]
            },
            {
                id: 'pregnancy',
                icon: '🤰',
                name: '妊娠・出産',
                items: [
                    { id: 'maybe_pregnant', label: '妊娠したかも' },
                    { id: 'find_obgyn', label: '産婦人科の探し方' },
                    { id: 'birth_cost', label: '出産費用のこと' }
                ]
            }
        ]
    },
    life: {
        name: '生活の困りごと',
        icon: '🏠',
        middle: [
            {
                id: 'housing',
                icon: '🏡',
                name: '住まい探し・引っ越し',
                items: [
                    { id: 'find_room', label: '部屋を借りたい' },
                    { id: 'no_guarantor', label: '保証人がいない' },
                    { id: 'real_estate_trouble', label: '不動産トラブル' }
                ]
            },
            {
                id: 'neighbor',
                icon: '👥',
                name: '近所とのトラブル',
                items: [
                    { id: 'noise', label: '騒音で苦情を言われた' },
                    { id: 'neighbor_trouble', label: '隣人とのトラブル' },
                    { id: 'landlord_trouble', label: '大家とのトラブル' }
                ]
            },
            {
                id: 'garbage',
                icon: '🗑️',
                name: 'ゴミ出し・ルール',
                items: [
                    { id: 'how_to_dispose', label: 'ゴミの出し方がわからない' },
                    { id: 'got_angry', label: 'ゴミで怒られた' },
                    { id: 'bulky_waste', label: '粗大ゴミの捨て方' }
                ]
            },
            {
                id: 'transportation',
                icon: '🚃',
                name: '交通・移動',
                items: [
                    { id: 'train', label: '電車の乗り方' },
                    { id: 'license', label: '免許を取りたい' },
                    { id: 'bicycle_rules', label: '自転車のルール' }
                ]
            }
        ]
    },
    family: {
        name: '家族・人間関係',
        icon: '👨‍👩‍👧',
        middle: [
            {
                id: 'marriage',
                icon: '💑',
                name: '結婚・離婚',
                items: [
                    { id: 'international_marriage', label: '国際結婚の手続き' },
                    { id: 'divorce', label: '離婚したい' },
                    { id: 'spouse_visa', label: '配偶者ビザのこと' }
                ]
            },
            {
                id: 'children',
                icon: '👶',
                name: '子ども・教育',
                items: [
                    { id: 'nursery', label: '保育園に入れたい' },
                    { id: 'school', label: '学校のこと' },
                    { id: 'childcare_support', label: '子育て支援を知りたい' }
                ]
            },
            {
                id: 'dv',
                icon: '😢',
                name: 'DV・暴力',
                items: [
                    { id: 'domestic_violence', label: '家族から暴力を受けている' },
                    { id: 'want_to_escape', label: '逃げたい' },
                    { id: 'shelter', label: 'シェルターを知りたい' }
                ]
            },
            {
                id: 'relationships',
                icon: '👥',
                name: '友人・恋人とのトラブル',
                items: [
                    { id: 'fight', label: '友達とケンカした' },
                    { id: 'scammed', label: '詐欺にあった' },
                    { id: 'stalker', label: 'ストーカー被害' }
                ]
            }
        ]
    },
    visa: {
        name: 'ビザ・手続き',
        icon: '📄',
        middle: [
            {
                id: 'renewal',
                icon: '🛂',
                name: '在留資格の更新',
                items: [
                    { id: 'how_to_renew', label: '更新の方法がわからない' },
                    { id: 'not_approved', label: '更新が許可されなかった' },
                    { id: 'documents', label: '必要書類がわからない' }
                ]
            },
            {
                id: 'change',
                icon: '🔄',
                name: '在留資格の変更',
                items: [
                    { id: 'change_job', label: '転職したい' },
                    { id: 'marriage_visa', label: '結婚したからビザを変えたい' },
                    { id: 'not_approved_change', label: '変更が認められなかった' }
                ]
            },
            {
                id: 'permanent',
                icon: '🌟',
                name: '永住権・帰化',
                items: [
                    { id: 'permanent_residence', label: '永住権を取りたい' },
                    { id: 'naturalization', label: '日本国籍を取りたい' },
                    { id: 'requirements', label: '条件がわからない' }
                ]
            },
            {
                id: 'reentry',
                icon: '✈️',
                name: '再入国・一時帰国',
                items: [
                    { id: 'go_back', label: 'ベトナムに帰りたい' },
                    { id: 'reentry_permit', label: '再入国許可のこと' },
                    { id: 'passport', label: 'パスポートのこと' }
                ]
            }
        ]
    }
};

// ========================================
// LIFF初期化
// ========================================
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        const profile = await liff.getProfile();
        userId = profile.userId;

        // UI描画
        renderUI();
        
        // ローディング非表示
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';

    } catch (error) {
        console.error('LIFF初期化エラー:', error);
        showError('初期化に失敗しました: ' + error.message);
    }
}

// ========================================
// UI描画
// ========================================
function renderUI() {
    renderHomeTab();
    renderDetailTabs();
    renderHistoryTab();
    setupTabNavigation();
}

// ホームタブ描画
function renderHomeTab() {
    const container = document.getElementById('home-categories');
    container.innerHTML = '';

    Object.entries(categories).forEach(([key, category]) => {
        const section = document.createElement('div');
        section.className = 'home-category-section';
        
        // ヘッダー
        const header = document.createElement('div');
        header.className = 'home-category-header';
        header.innerHTML = `
            <div class="home-category-title">${category.icon} ${category.name}</div>
            <a href="#" class="more-link" data-tab="${key}">もっと見る ›</a>
        `;
        
        // カード表示（最初の3つ）
        const cards = document.createElement('div');
        cards.className = 'home-category-cards';
        
        category.middle.slice(0, 3).forEach(middle => {
            const card = document.createElement('div');
            card.className = 'home-card';
            card.innerHTML = `
                <div class="home-card-icon">${middle.icon}</div>
                <div class="home-card-label">${middle.name}</div>
            `;
            card.onclick = () => switchTab(key);
            cards.appendChild(card);
        });
        
        section.appendChild(header);
        section.appendChild(cards);
        container.appendChild(section);
    });

    // もっと見るリンクのイベント
    document.querySelectorAll('.more-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = e.target.dataset.tab;
            switchTab(tab);
        });
    });
}

// 詳細タブ描画
function renderDetailTabs() {
    Object.entries(categories).forEach(([key, category]) => {
        const container = document.getElementById(`${key}-categories`);
        container.innerHTML = '';

        category.middle.forEach(middle => {
            const section = document.createElement('div');
            section.className = 'middle-category';
            
            const header = document.createElement('div');
            header.className = 'middle-category-header';
            header.textContent = `${middle.icon} ${middle.name}`;
            
            const items = document.createElement('div');
            items.className = 'small-items';
            
            middle.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'small-item';
                itemDiv.innerHTML = `
                    <span class="small-item-label">${item.label}</span>
                    <span class="small-item-arrow">▶</span>
                `;
                itemDiv.onclick = () => selectTemplate(key, middle.id, item.id, item.label);
                items.appendChild(itemDiv);
            });
            
            section.appendChild(header);
            section.appendChild(items);
            container.appendChild(section);
        });
    });
}

// 履歴タブ描画
async function renderHistoryTab() {
    const container = document.getElementById('history-list');
    
    try {
        const response = await fetch(`${API_URL}/get-consultation-history?user_id=${userId}`);
        const data = await response.json();
        
        if (data.success && data.history && data.history.length > 0) {
            container.innerHTML = '';
            data.history.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <div class="history-item-title">${item.emoji} ${item.label}</div>
                    <div class="history-item-path">${item.categoryPath}</div>
                    <div class="history-item-footer">
                        <span class="history-item-date">${formatDate(item.created_at)}</span>
                        <button class="history-item-button">▶ 再相談</button>
                    </div>
                `;
                historyItem.querySelector('.history-item-button').onclick = (e) => {
                    e.stopPropagation();
                    reselectTemplate(item);
                };
                container.appendChild(historyItem);
            });
        } else {
            container.innerHTML = `
                <div class="history-empty">
                    <p>😸</p>
                    <p>まだ相談履歴がないにゃ</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('履歴取得エラー:', error);
        container.innerHTML = `
            <div class="history-empty">
                <p>😿</p>
                <p>履歴の読み込みに失敗したにゃ</p>
            </div>
        `;
    }
}

// ========================================
// タブ切り替え
// ========================================
function setupTabNavigation() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    // タブボタンのアクティブ切り替え
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });

    // タブコンテンツの切り替え
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });
    
    const activePane = document.getElementById(`${tab}-tab`);
    if (activePane) {
        activePane.classList.add('active');
        activePane.style.display = 'block';
    }
    
    // 履歴タブの場合、再読み込み
    if (tab === 'history') {
        renderHistoryTab();
    }
}

// ========================================
// テンプレート選択(新規相談)
// ========================================
async function selectTemplate(mainCat, middleCat, smallCat, label) {
    try {
        // LINEメッセージとして送信
        await liff.sendMessages([{
            type: 'text',
            text: label
        }]);
        
        // LIFFウィンドウを閉じる
        liff.closeWindow();
    } catch (error) {
        console.error('テンプレート選択エラー:', error);
        alert('メッセージ送信に失敗しました');
    }
}

// 再相談
async function reselectTemplate(item) {
    try {
        // ✅ APIを呼ばず、LINEメッセージとして送信
        await liff.sendMessages([{
            type: 'text',
            text: `もう一度相談: ${item.label}`
        }]);
        
        // LIFFを閉じてLINEトークに戻る
        liff.closeWindow();
    } catch (error) {
        console.error('メッセージ送信エラー:', error);
        alert('メッセージの送信に失敗しました');
    }
}

// ========================================
// ユーティリティ
// ========================================
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days === 0) return '今日';
    if (days === 1) return '昨日';
    if (days < 7) return `${days}日前`;
    
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('error').style.display = 'flex';
    document.getElementById('error-message').textContent = message;
}

// ========================================
// 初期化実行
// ========================================
window.onload = () => {
    initializeLiff();
};