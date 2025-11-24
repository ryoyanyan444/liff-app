// ⚠️ 後で自分の値に書き換える！
const CONFIG = {
    LIFF_ID: '2008551240-vWN36gzR',  // ← 後でLINE Developersから取得したLIFF IDに書き換える
    GAS_API_URL: 'https://script.google.com/macros/s/AKfycbwDM80XlwPf9A2oj1OnqEK7vKwy2ry-3rfIAUrV1Ri3WyEasa1pbnaUcBCk7UCVQQ-Y/exec'  // ← 自分のGAS APIのURLに書き換える（例: https://script.google.com/macros/s/XXXXX/exec）
};

// LIFF初期化
async function initializeLIFF() {
    try {
        await liff.init({ liffId: CONFIG.LIFF_ID });
        
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        // ユーザー情報取得
        const profile = await liff.getProfile();
        updateProfileUI(profile);
        
        // GAS APIからユーザーデータ取得
        await fetchUserData(profile.userId);
        
    } catch (error) {
        console.error('LIFF初期化エラー:', error);
        alert('エラーが発生しました: ' + error.message);
    }
}

// プロフィールUI更新
function updateProfileUI(profile) {
    document.getElementById('profile-name').textContent = profile.displayName;
    
    if (profile.pictureUrl) {
        document.getElementById('profile-avatar').innerHTML = 
            `<img src="${profile.pictureUrl}" alt="Profile">`;
    }
}

// GAS APIからユーザーデータ取得
async function fetchUserData(userId) {
    try {
        const response = await fetch(`${CONFIG.GAS_API_URL}?action=getUserInfo&userId=${userId}`);
        const data = await response.json();
        
        if (data.success) {
            updateUsageUI(data.user);
        }
    } catch (error) {
        console.error('ユーザーデータ取得エラー:', error);
    }
}

// 使用状況UI更新
function updateUsageUI(user) {
    document.getElementById('user-plan').textContent = user.plan || 'free';
    document.getElementById('today-count').textContent = user.todayCount || 0;
    document.getElementById('vision-count').textContent = user.visionCount || 0;
    
    // プラン上限を表示
    const limits = {
        free: { text: 10, vision: 0 },
        trial: { text: -1, vision: 30 },
        premium: { text: -1, vision: 30 }
    };
    
    const planLimits = limits[user.plan] || limits.free;
    document.querySelectorAll('.usage-limit')[0].textContent = 
        planLimits.text === -1 ? '/ ∞' : `/ ${planLimits.text}`;
    document.querySelectorAll('.usage-limit')[1].textContent = 
        planLimits.vision === -1 ? '/ ∞' : `/ ${planLimits.vision}`;
}

// プレミアムアップグレードボタン
document.addEventListener('DOMContentLoaded', () => {
    const upgradeBtn = document.getElementById('upgrade-btn');
    
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', async () => {
            try {
                const profile = await liff.getProfile();
                const response = await fetch(
                    `${CONFIG.GAS_API_URL}?action=getUpgradeLink&userId=${profile.userId}`
                );
                const data = await response.json();
                
                if (data.success && data.upgradeLink) {
                    // Stripe決済ページへ遷移
                    liff.openWindow({
                        url: data.upgradeLink,
                        external: true
                    });
                } else {
                    alert('決済リンクの取得に失敗しました');
                }
            } catch (error) {
                console.error('アップグレードエラー:', error);
                alert('エラーが発生しました');
            }
        });
    }
});

// LIFF起動
initializeLIFF();
