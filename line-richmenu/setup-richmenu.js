const axios = require('axios');
const fs = require('fs');

// ========== 🔧 設定 ==========
const CONFIG = {
  channelAccessToken: 'QaI7weNXO+oZg5b+IQRCw9RbhaQ7sNW4/KNLzkbe8n/0kNoRL/XRswxiIMGhbqHR+HccG6Y5p2nRdPkbDaRtnsmf1U/id7UEnwwfABpFyZuGzpVB0d1WLIiBwousRunQ0SGjF7PyC4GNDOg5XyQAuAdB04t89/1O/w1cDnyilFU=',
  botId: '@687hoviz',
  imagePath: './richmenu.png'
};

// ========== 📱 Rich Menu定義 (修正版) ==========
const richMenuData = {
  size: {
    width: 2500,
    height: 1686
  },
  selected: true,
  name: 'Miu Bot Menu',
  chatBarText: 'メニュー',
  areas: [
    // 1. 宿題・レポート (上部バー)
    {
      bounds: { x: 0, y: 0, width: 2500, height: 283 },
      action: {
        type: 'message',
        text: '/menu homework_report'
      }
    },
    // 2. Miuと話す (左側大きいエリア)
    {
      bounds: { x: 0, y: 283, width: 855, height: 1176 },
      action: {
        type: 'message',
        text: '/mode miu-chat'
      }
    },
    // 3. テンプレ (中央上)
    {
      bounds: { x: 855, y: 283, width: 811, height: 579 },
      action: {
        type: 'uri',
        uri: 'https://liff.line.me/2008551240-W6log3Gr'
      }
    },
    // 4. 返信モード (右上)
    {
      bounds: { x: 1666, y: 284, width: 833, height: 579 },
      action: {
        type: 'message',
        text: '/mode reply'
      }
    },
    // 5. 翻訳モード (中央下)
    {
      bounds: { x: 855, y: 862, width: 811, height: 597 },
      action: {
        type: 'message',
        text: '/mode translate'
      }
    },
    // 6. 画像生成 (右下)
    {
      bounds: { x: 1666, y: 863, width: 833, height: 597 },
      action: {
        type: 'message',
        text: '/mode image'
      }
    },
    // 7. メッセージ欄展開 (最下部左) ✅ 修正
    {
      bounds: { x: 0, y: 1460, width: 1665, height: 226 },
      action: {
        type: 'postback',
        data: 'action=open_keyboard',
        inputOption: 'openKeyboard'
      }
    },
    // 8. 音声入力オン (最下部中央) ✅ 修正
    {
      bounds: { x: 1666, y: 1461, width: 256, height: 226 },
      action: {
        type: 'postback',
        data: 'action=open_voice',
        inputOption: 'openVoice'
      }
    },
    // 9. シェアリンク展開 (最下部右)
    {
      bounds: { x: 1922, y: 1461, width: 578, height: 226 },
      action: {
        type: 'uri',
        uri: `https://line.me/R/nv/recommendOA/${CONFIG.botId}`
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
    console.log('\n📱 メニュー構成:');
    console.log('  - 宿題・レポート (上部)');
    console.log('  - Miuと話す (左側)');
    console.log('  - テンプレ (中央上)');
    console.log('  - 返信モード (右上)');
    console.log('  - 翻訳モード (中央下)');
    console.log('  - 画像生成 (右下)');
    console.log('  - キーボード/音声/シェア (最下部)');
    
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