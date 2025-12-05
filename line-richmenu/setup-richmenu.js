const axios = require('axios');
const fs = require('fs');

// ========== 🔧 設定 ==========
const CONFIG = {
  channelAccessToken: 'QaI7weNXO+oZg5b+IQRCw9RbhaQ7sNW4/KNLzkbe8n/0kNoRL/XRswxiIMGhbqHR+HccG6Y5p2nRdPkbDaRtnsmf1U/id7UEnwwfABpFyZuGzpVB0d1WLIiBwousRunQ0SGjF7PyC4GNDOg5XyQAuAdB04t89/1O/w1cDnyilFU=',
  botId: '@687hoviz',
  liffId: '2008551240-W6log3Gr',
  imagePath: './line-richmenu/rich_main.png'
};

// ========== 📱 Rich Menu定義（9エリア構成） ==========
const richMenuData = {
  size: {
    width: 2500,
    height: 1686
  },
  selected: true,
  name: 'Miu メインメニュー',
  chatBarText: 'メニューを開く',
  areas: [
    // エリア1: テンプレート (左上) - LIFF起動
    {
      bounds: { x: 0, y: 0, width: 834, height: 843 },
      action: {
        type: 'uri',
        label: 'テンプレート',
        uri: `https://liff.line.me/${CONFIG.liffId}`
      }
    },
    
    // エリア2: Miuとおしゃべり (中央上) - モード切替
    {
      bounds: { x: 834, y: 0, width: 832, height: 843 },
      action: {
        type: 'message',
        label: 'Miuとおしゃべり',
        text: '/mode miu-chat'
      }
    },
    
    // エリア3: カメラ翻訳 (右上) - カメラ起動
    {
      bounds: { x: 1666, y: 0, width: 834, height: 843 },
      action: {
        type: 'camera',
        label: 'カメラ翻訳'
      }
    },
    
    // エリア4: 翻訳選択 (左下1) - 翻訳モード切替
    {
      bounds: { x: 0, y: 843, width: 625, height: 843 },
      action: {
        type: 'message',
        label: '翻訳選択',
        text: '/mode translate'
      }
    },
    
    // エリア5: 返信作成 (左下2)
    {
      bounds: { x: 625, y: 843, width: 625, height: 843 },
      action: {
        type: 'message',
        label: '返信作成',
        text: '返信作成'
      }
    },
    
    // エリア6: キーボード展開 (中央下1) - ポストバック
    {
      bounds: { x: 1250, y: 843, width: 417, height: 843 },
      action: {
        type: 'postback',
        label: 'キーボード展開',
        data: 'action=openKeyboard',
        inputOption: 'openKeyboard'
      }
    },
    
    // エリア7: 音声メッセージ (中央下2) - ポストバック
    {
      bounds: { x: 1667, y: 843, width: 416, height: 843 },
      action: {
        type: 'postback',
        label: '音声メッセージ',
        data: 'action=openVoice',
        inputOption: 'openVoice'
      }
    },
    
    // エリア8: シェア (右下1) - URI
    {
      bounds: { x: 2083, y: 843, width: 417, height: 843 },
      action: {
        type: 'uri',
        label: 'シェア',
        uri: `https://line.me/R/nv/recommendOA/${CONFIG.botId}`
      }
    },
    
    // エリア9: マイページ (右上端) - 準備中
    {
      bounds: { x: 2083, y: 0, width: 417, height: 843 },
      action: {
        type: 'message',
        label: 'マイページ',
        text: 'マイページ(準備中)'
      }
    }
  ]
};

// ========== 🚀 メイン処理 ==========
async function setupRichMenu() {
  console.log('🚀 Miu Bot Rich Menu Setup Start\n');
  
  const headers = {
    'Authorization': `Bearer ${CONFIG.channelAccessToken}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // 既存のデフォルトリッチメニューを削除
    console.log('🗑️  Removing old default rich menu...');
    try {
      await axios.delete(
        'https://api.line.me/v2/bot/user/all/richmenu',
        { headers }
      );
      console.log('✅ Old menu removed\n');
    } catch (e) {
      console.log('ℹ️  No existing default menu\n');
    }

    // 新しいリッチメニューを作成
    console.log('📱 Creating new Rich Menu...');
    const response = await axios.post(
      'https://api.line.me/v2/bot/richmenu',
      richMenuData,
      { headers }
    );
    const richMenuId = response.data.richMenuId;
    console.log(`✅ Created: ${richMenuId}\n`);
    
    // 画像をアップロード
    console.log('🖼️  Uploading image...');
    const imageBuffer = fs.readFileSync(CONFIG.imagePath);
    await axios.post(
      `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
      imageBuffer,
      {
        headers: {
          'Authorization': headers.Authorization,
          'Content-Type': 'image/png'
        }
      }
    );
    console.log('✅ Image uploaded\n');
    
    // デフォルトとして設定
    console.log('⚙️  Setting as default...');
    await axios.post(
      `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
      {},
      { headers }
    );
    console.log('✅ Set as default\n');
    
    console.log('🎉 COMPLETE! Check your LINE app!');
    console.log(`📋 Rich Menu ID: ${richMenuId}`);
    console.log('\n📱 メニュー構成（9エリア）:');
    console.log('  1. テンプレート (左上) → LIFF起動');
    console.log('  2. Miuとおしゃべり (中央上) → /mode miu-chat');
    console.log('  3. カメラ翻訳 (右上) → カメラ起動 📷');
    console.log('  4. 翻訳選択 (左下1) → /mode translate');
    console.log('  5. 返信作成 (左下2) → メッセージ送信');
    console.log('  6. キーボード展開 (中央下1) → キーボード直接起動 ⌨️');
    console.log('  7. 音声メッセージ (中央下2) → 音声入力直接起動 🎤');
    console.log('  8. シェア (右下1) → ボット紹介ページ');
    console.log('  9. マイページ (右上端) → 準備中');
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

setupRichMenu();
