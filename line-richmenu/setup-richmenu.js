const line = require('@line/bot-sdk');
const fs = require('fs');
const axios = require('axios');

const CONFIG = {
  channelAccessToken: 'QaI7weNXO+oZg5b+IQRCw9RbhaQ7sNW4/KNLzkbe8n/0kNoRL/XRswxiIMGhbqHR+HccG6Y5p2nRdPkbDaRtnsmf1U/id7UEnwwfABpFyZuGzpVB0d1WLIiBwousRunQ0SGjF7PyC4GNDOg5XyQAuAdB04t89/1O/w1cDnyilFU=',
  botId: '@687hoviz',
  liffId: '2008551240-W6log3Gr',
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: CONFIG.channelAccessToken,
});

// ベトナム語版のエリア定義
const AREAS_VI = [
  // 上段：テンプレート（全幅）
  { 
    label: 'Mẫu', 
    bounds: { x: 0, y: 0, width: 2500, height: 283 }, 
    action: { type: 'uri', uri: `https://liff.line.me/${CONFIG.liffId}` } 
  },
  // 中段左：Miuとおしゃべり
  { 
    label: 'Trò chuyện với Miu', 
    bounds: { x: 0, y: 283, width: 867, height: 1176 }, 
    action: { type: 'message', text: '/mode miu-chat' } 
  },
  // 中段中央：カメラ翻訳
  { 
    label: 'Dịch bằng camera', 
    bounds: { x: 867, y: 283, width: 815, height: 1176 }, 
    action: { type: 'message', text: '/camera-translate' } 
  },
  // 中段右上：テキスト翻訳
  { 
    label: 'Dịch văn bản', 
    bounds: { x: 1682, y: 284, width: 817, height: 579 }, 
    action: { type: 'message', text: '/mode translate' } 
  },
  // 中段右下：返信文作成
  { 
    label: 'Tạo câu trả lời', 
    bounds: { x: 1682, y: 863, width: 817, height: 597 }, 
    action: { type: 'message', text: '/mode reply' } 
  },
  // 下段左：キーボード展開
  { 
    label: 'Mở bàn phím', 
    bounds: { x: 0, y: 1460, width: 1435, height: 226 }, 
    action: { type: 'postback', data: 'action=openKeyboard', inputOption: 'openKeyboard' } 
  },
  // 下段中央：音声メッセージ
  { 
    label: 'Tin nhắn thoại', 
    bounds: { x: 1435, y: 1463, width: 247, height: 226 }, 
    action: { type: 'postback', data: 'action=openVoice', inputOption: 'openVoice' } 
  },
  // 下段右から2番目：シェア
  { 
    label: 'Chia sẻ', 
    bounds: { x: 1682, y: 1461, width: 516, height: 226 }, 
    action: { type: 'uri', uri: `https://line.me/R/nv/recommendOA/${CONFIG.botId}` } 
  },
  // 下段右端：マイページ
  { 
    label: 'Trang của tôi', 
    bounds: { x: 2198, y: 1461, width: 302, height: 226 }, 
  action: { type: 'uri', uri: 'https://liff.line.me/2008551240-lQ0qWLdx' }
  },
];

// 日本語版のエリア定義
const AREAS_JA = [
  // 上段：テンプレート（全幅）
  { 
    label: 'テンプレート', 
    bounds: { x: 0, y: 0, width: 2500, height: 283 }, 
    action: { type: 'uri', uri: `https://liff.line.me/${CONFIG.liffId}` } 
  },
  // 中段左：Miuとおしゃべり
  { 
    label: 'Miuとはなす', 
    bounds: { x: 0, y: 283, width: 867, height: 1176 }, 
    action: { type: 'message', text: '/mode miu-chat' } 
  },
  // 中段中央：カメラ翻訳
  { 
    label: 'ほんやくする（カメラ）', 
    bounds: { x: 867, y: 283, width: 815, height: 1176 }, 
    action: { type: 'message', text: '/camera-translate' } 
  },
  // 中段右上：テキスト翻訳
  { 
    label: 'ほんやくする（テキスト）', 
    bounds: { x: 1682, y: 284, width: 817, height: 579 }, 
    action: { type: 'message', text: '/mode translate' } 
  },
  // 中段右下：返信文作成
  { 
    label: 'へんしんぶんをつくる', 
    bounds: { x: 1682, y: 863, width: 817, height: 597 }, 
    action: { type: 'message', text: '/mode reply' } 
  },
  // 下段左：キーボード展開
  { 
    label: 'キーボードをひらく', 
    bounds: { x: 0, y: 1460, width: 1435, height: 226 }, 
    action: { type: 'postback', data: 'action=openKeyboard', inputOption: 'openKeyboard' } 
  },
  // 下段中央：音声メッセージ
  { 
    label: 'おんせいメッセージ', 
    bounds: { x: 1435, y: 1463, width: 247, height: 226 }, 
    action: { type: 'postback', data: 'action=openVoice', inputOption: 'openVoice' } 
  },
  // 下段右から2番目：シェア
  { 
    label: 'ともだちにシェア', 
    bounds: { x: 1682, y: 1461, width: 516, height: 226 }, 
    action: { type: 'uri', uri: `https://line.me/R/nv/recommendOA/${CONFIG.botId}` } 
  },
  // 下段右端：マイページ
  { 
    label: 'マイページ', 
    bounds: { x: 2198, y: 1461, width: 302, height: 226 }, 
    action: { type: 'uri', uri: 'https://liff.line.me/2008551240-lQ0qWLdx' }
 
  },
];

const RICH_MENUS = [
  {
    name: 'Miu Menu (Tiếng Việt - Chưa hoàn thành)',
    language: 'vi',
    status: 'incomplete',
    chatBarText: 'Thực đơn',  // ベトナム語
    imagePath: './rich_main_vi.png',
    areas: AREAS_VI,
  },
  {
    name: 'Miu Menu (Tiếng Việt - Hoàn thành)',
    language: 'vi',
    status: 'complete',
    chatBarText: 'Thực đơn',  // ベトナム語
    imagePath: './rich_main_vi_complete.png',
    areas: AREAS_VI,
  },
  {
    name: 'Miu メインメニュー (日本語 - 未入力)',
    language: 'ja',
    status: 'incomplete',
    chatBarText: 'メニュー',  // 日本語
    imagePath: './rich_main_ja.png',
    areas: AREAS_JA,
  },
  {
    name: 'Miu メインメニュー (日本語 - 完了)',
    language: 'ja',
    status: 'complete',
    chatBarText: 'メニュー',  // 日本語
    imagePath: './rich_main_ja_complete.png',
    areas: AREAS_JA,
  },
];

async function setupAllRichMenus() {
  console.log('🚀 Miu Bot Rich Menu Setup (4 versions) Start...\n');

  try {
    const defaultMenuId = await client.getDefaultRichMenuId();
    if (defaultMenuId) {
      await client.cancelDefaultRichMenu();
      console.log('✅ Removed old default rich menu\n');
    }
  } catch (err) {
    console.log('ℹ️ No default rich menu found\n');
  }

  const results = {};

  for (const menu of RICH_MENUS) {
    console.log(`📋 Creating: ${menu.name}...`);

    try {
      // createRichMenuの戻り値を正しく取得
      const response = await client.createRichMenu({
        size: { width: 2500, height: 1686 },
        selected: false,
        name: menu.name,
        chatBarText: menu.chatBarText,  // 言語ごとに変更
        areas: menu.areas,
      });

      // レスポンスからrichMenuIdを抽出
      const richMenuId = response.richMenuId || response;
      console.log(`✅ Rich menu created: ${richMenuId}`);

      // 画像をアップロード
      const imageBuffer = fs.readFileSync(menu.imagePath);
      await axios.post(
        `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
        imageBuffer,
        {
          headers: {
            'Content-Type': 'image/png',
            Authorization: `Bearer ${CONFIG.channelAccessToken}`,
          },
        }
      );

      console.log(`✅ Image uploaded: ${menu.imagePath}\n`);

      const key = `${menu.language}_${menu.status}`;
      results[key] = richMenuId;
    } catch (error) {
      console.error(`❌ Error creating ${menu.name}:`);
      console.error('Error type:', error.constructor.name);
      console.error('Status:', error.response?.status);
      console.error('Message:', error.message);
      
      const key = `${menu.language}_${menu.status}`;
      results[key] = 'FAILED';
    }
  }

  if (results.vi_incomplete && results.vi_incomplete !== 'FAILED') {
    try {
      await client.setDefaultRichMenu(results.vi_incomplete);
      console.log('✅ Set default rich menu: ベトナム語・未入力版\n');
    } catch (err) {
      console.error('❌ Failed to set default rich menu:', err.message);
    }
  }

  console.log('🎉 COMPLETE! Rich Menu IDs:\n');
  console.log('========================================');
  console.log(`RICH_MENU_VI_INCOMPLETE_ID=${results.vi_incomplete || 'FAILED'}`);
  console.log(`RICH_MENU_VI_COMPLETE_ID=${results.vi_complete || 'FAILED'}`);
  console.log(`RICH_MENU_JA_INCOMPLETE_ID=${results.ja_incomplete || 'FAILED'}`);
  console.log(`RICH_MENU_JA_COMPLETE_ID=${results.ja_complete || 'FAILED'}`);
  console.log('========================================\n');
  console.log('✅ 上記の4つのIDをVercelの環境変数に追加してください！');
}

setupAllRichMenus();