// ==============================
// Vercel / LIFF 設定
// ==============================
const CONFIG = {
  LIFF_ID: '2008551240-vWN36gzR',
  API_URL: 'https://api.ai-chat-jp.com/api'
};

let liffReady = false;

// ==============================
// LIFF 初期化ヘルパー
// ==============================
async function ensureLiffReady() {
  if (liffReady) return true;

  await liff.init({ liffId: CONFIG.LIFF_ID });
  liffReady = true;

  if (!liff.isLoggedIn()) {
    liff.login();
    return false; // login に飛ばしたのでここで止める
  }
  return true;
}

// ==============================
// LIFF初期化 & 初期データ読み込み
// ==============================
async function initializeLIFF() {
  try {
    const ok = await ensureLiffReady();
    if (!ok) return; // ログインに飛んだだけ

    const profile = await liff.getProfile();
    updateProfileUI(profile);

    await fetchUserData(profile.userId);
  } catch (error) {
    console.error('LIFF初期化エラー:', error);
    alert('エラーが発生しました: ' + error.message);
  }
}

// ==============================
// プロフィールUI更新
// ==============================
function updateProfileUI(profile) {
  document.getElementById('profile-name').textContent = profile.displayName;

  if (profile.pictureUrl) {
    document.getElementById('profile-avatar').innerHTML =
      `<img src="${profile.pictureUrl}" alt="Profile">`;
  }
}

// ==============================
// Vercel APIからユーザーデータ取得
// ==============================
async function fetchUserData(userId) {
  try {
    const response = await fetch(`${CONFIG.API_URL}/get-user-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // API が { success:true, user:{...} } でも user単体でも動くようにする
    const user = data.user || data;

    updateUsageUI(user);
  } catch (error) {
    console.error('ユーザーデータ取得エラー:', error);
  }
}

// ==============================
// 使用状況UI更新
// ==============================
function updateUsageUI(user) {
  document.getElementById('user-plan').textContent = user.plan || 'free';
  document.getElementById('today-count').textContent = user.today_count ?? 0;
  document.getElementById('vision-count').textContent = user.vision_count ?? 0;

  // Supabase側 get-user-info.js の想定と揃えた使用上限
  const limits = {
    free:    { text: 10,  vision: 3 },
    trial:   { text: 50,  vision: 20 },
    premium: { text: -1,  vision: -1 } // -1 = 無制限表示
  };

  const planLimits = limits[user.plan] || limits.free;

  const limitEls = document.querySelectorAll('.usage-limit');
  if (limitEls[0]) {
    limitEls[0].textContent =
      planLimits.text === -1 ? '/ ∞' : `/ ${planLimits.text}`;
  }
  if (limitEls[1]) {
    limitEls[1].textContent =
      planLimits.vision === -1 ? '/ ∞' : `/ ${planLimits.vision}`;
  }

  // Premium or trial のときだけ管理セクション表示
  if (user.plan === 'premium' || user.plan === 'trial') {
    const cancelSection = document.getElementById('cancel-section');
    if (cancelSection) cancelSection.style.display = 'block';
    setupPortalButton();
  }
}

// ==============================
// Stripe Customer Portal ボタン
// ==============================
function setupPortalButton() {
  const portalBtn = document.getElementById('portal-btn');
  if (!portalBtn || portalBtn.hasAttribute('data-initialized')) return;

  portalBtn.setAttribute('data-initialized', 'true');

  portalBtn.addEventListener('click', async () => {
    try {
      const ok = await ensureLiffReady();
      if (!ok) return;

      const profile = await liff.getProfile();

      portalBtn.disabled = true;
      portalBtn.textContent = '読み込み中...';

      const response = await fetch(`${CONFIG.API_URL}/get-portal-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.userId })
      });

      const data = await response.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        alert(
          '管理ページの取得に失敗しました: ' +
            (data.message || data.error || '不明なエラー')
        );
        portalBtn.disabled = false;
        portalBtn.textContent = 'アカウント管理ページへ';
      }
    } catch (error) {
      console.error('ポータルエラー:', error);
      alert('エラーが発生しました: ' + error.message);
      portalBtn.disabled = false;
      portalBtn.textContent = 'アカウント管理ページへ';
    }
  });
}

// ==============================
// プレミアムアップグレードボタン（Stripe Checkout）
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  const upgradeBtn = document.getElementById('upgrade-btn');

  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', async () => {
      try {
        const ok = await ensureLiffReady();
        if (!ok) return;

        const profile = await liff.getProfile();

        // 選択されたプランを取得
        const selectedPlan = document.querySelector(
          'input[name="plan"]:checked'
        ).value;
        // backend 側は "3months" / "1month" を見ている想定
        const planType = selectedPlan === '3month' ? '3months' : '1month';

        upgradeBtn.disabled = true;
        upgradeBtn.textContent = '処理中...';

        const response = await fetch(`${CONFIG.API_URL}/stripe-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.userId,
            planType
          })
        });

        const data = await response.json();

        if (data.success && data.url) {
          // Stripe 決済ページへ遷移
          window.location.href = data.url;
        } else {
          alert(
            '決済リンクの取得に失敗しました: ' +
              (data.message || data.error || '不明なエラー')
          );
          upgradeBtn.disabled = false;
          upgradeBtn.textContent = 'Premium にアップグレード';
        }
      } catch (error) {
        console.error('アップグレードエラー:', error);
        alert('エラーが発生しました: ' + error.message);
        upgradeBtn.disabled = false;
        upgradeBtn.textContent = 'Premium にアップグレード';
      }
    });
  }

  // 初期ロード時に LIFF & ユーザー情報を読み込み
  initializeLIFF();
});
