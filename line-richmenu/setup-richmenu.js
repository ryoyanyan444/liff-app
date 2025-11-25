const axios = require('axios');
const fs = require('fs');

// ========== 🔧 設定（ここだけ変更） ==========
const CONFIG = {
  channelAccessToken: 'QaI7weNXO+oZg5b+IQRCw9RbhaQ7sNW4/KNLzkbe8n/0kNoRL/XRswxiIMGhbqHR+HccG6Y5p2nRdPkbDaRtnsmf1U/id7UEnwwfABpFyZuGzpVB0d1WLIiBwousRunQ0SGjF7PyC4GNDOg5XyQAuAdB04t89/1O/w1cDnyilFU=',
  botId: '@687hoviz',  // ⚠️ あなたの実際のBOT IDに変更してください
  imagePath: './richmenu.png'
};

// ========== 📱 Rich Menu定義 ==========
const richMenuData = {
  size: {
    width: 2500,
    height: 1686
  },
  selected: true,
  name: 'AI Chat Menu',
  chatBarText: 'メニュー',
  areas: [
    // 上部バー: LIFF
    {
      bounds: { x: 0, y: 0, width: 2500, height: 283 },
      action: {
        type: 'uri',
        uri: 'https://liff.line.me/2008551240-W6log3Gr'
      }
    },
    // 左上: 通常モード
    {
      bounds: { x: 0, y: 284, width: 833, height: 579 },
      action: {
        type: 'postback',
        data: 'action=switch_mode&mode=normal',
        displayText: '✅ 通常モードに切り替え完了'
      }
    },
    // 中央上: リサーチモード
    {
      bounds: { x: 833, y: 284, width: 833, height: 579 },
      action: {
        type: 'postback',
        data: 'action=switch_mode&mode=deep_research',
        displayText: '✅ ディープリサーチモードに切り替え完了'
      }
    },
    // 右上: 高性能AI
    {
      bounds: { x: 1666, y: 284, width: 833, height: 579 },
      action: {
        type: 'postback',
        data: 'action=switch_mode&mode=high_performance',
        displayText: '✅ 高性能AIモードに切り替え完了'
      }
    },
    // 左下: 返信作成
    {
      bounds: { x: 0, y: 865, width: 833, height: 579 },
      action: {
        type: 'postback',
        data: 'action=reply_mode',
        displayText: '💬 返信文作成モード'
      }
    },
    // 中央下: テンプレート
    {
      bounds: { x: 833, y: 865, width: 833, height: 579 },
      action: {
        type: 'uri',
        uri: 'https://liff.line.me/2008551240-W6log3Gr'
      }
    },
    // 右下: 料金
    {
      bounds: { x: 1666, y: 865, width: 833, height: 579 },
      action: {
        type: 'postback',
        data: 'action=show_pricing',
        displayText: '💰 料金プラン'
      }
    },
    // 最下部左: キーボード展開
    {
      bounds: { x: 0, y: 1460, width: 1389, height: 226 },
      action: {
        type: 'postback',
        data: 'action=open_keyboard',
        inputOption: 'openKeyboard'
      }
    },
    // 最下部中央: ボイス展開
    {
      bounds: { x: 1390, y: 1460, width: 354, height: 226 },
      action: {
        type: 'postback',
        data: 'action=open_voice',
        inputOption: 'openVoice'
      }
    },
    // 最下部右: シェア
    {
      bounds: { x: 1744, y: 1460, width: 756, height: 226 },
      action: {
        type: 'uri',
        uri: `https://line.me/R/nv/recommendOA/${CONFIG.botId}`
      }
    }
  ]
};

// ========== 🚀 メイン処理 ==========
async function setupRichMenu() {
  console.log('🚀 Rich Menu Setup Start\n');
  
  const headers = {
    'Authorization': `Bearer ${CONFIG.channelAccessToken}`,
    'Content-Type': 'application/json'
  };
  
  try {
    console.log('📱 Creating Rich Menu...');
    const response = await axios.post(
      'https://api.line.me/v2/bot/richmenu',
      richMenuData,
      { headers }
    );
    const richMenuId = response.data.richMenuId;
    console.log(`✅ Created: ${richMenuId}\n`);
    
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
    
    console.log('⚙️  Setting as default...');
    await axios.post(
      `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
      {},
      { headers }
    );
    console.log('✅ Set as default\n');
    
    console.log('🎉 COMPLETE! Check your LINE app!');
    console.log(`📋 Rich Menu ID: ${richMenuId}`);
    
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
