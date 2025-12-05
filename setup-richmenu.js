const axios = require('axios');
const fs = require('fs');

// ========== 🔧 設定 ==========
const CONFIG = {
  channelAccessToken: 'QaI7weNXO+oZg5b+IQRCw9RbhaQ7sNW4/KNLzkbe8n/0kNoRL/XRswxiIMGhbqHR+HccG6Y5p2nRdPkbDaRtnsmf1U/id7UEnwwfABpFyZuGzpVB0d1WLIiBwousRunQ0SGjF7PyC4GNDOg5XyQAuAdB04t89/1O/w1cDnyilFU=',
  botId: '@687hoviz',
  liffId: '2008551240-W6log3Gr',
  imagePaths: {
    incomplete: './line-richmenu/rich_main.png',           // ⚠️マーク付き
    complete: './line-richmenu/rich_main_complete.png'     // ⚠️マークなし
  }
};

// ========== 📱 Rich Menu定義（9エリア構成） ==========
const richMenuAreas = [
  // エリア1: テンプレート (上部全体) - LIFF起動
  {
    bounds: { x: 0, y: 0, width: 2500, height: 283 },
    action: {
      type: 'uri',
      label: 'テンプレート',
      uri: `https://liff.line.me/${CONFIG.liffId}`
    }
  },
  
  // エリア2: Miuとおしゃべり (左中) - モード切替
  {
    bounds: { x: 0, y: 283, width: 867, height: 1176 },
    action: {
      type: 'message',
      label: 'Miuとおしゃべり',
      text: '/mode miu-chat'
    }
  },
  
  // エリア3: カメラ翻訳 (中央中) - カメラ翻訳モード
  {
    bounds: { x: 867, y: 283, width: 815, height: 1176 },
    action: {
      type: 'message',
      label: 'カメラ翻訳',
      text: '/camera-translate'
    }
  },
  
  // エリア4: 返信文作成 (右上) - 返信モード
  {
    bounds: { x: 1682, y: 284, width: 817, height: 579 },
    action: {
      type: 'message',
      label: '返信文作成',
      text: '/mode reply'
    }
  },
  
  // エリア5: 翻訳選択 (右中)
  {
    bounds: { x: 1682, y: 863, width: 817, height: 597 },
    action: {
      type: 'message',
      label: '翻訳選択',
      text: '/mode translate'
    }
  },
  
  // エリア6: 音声メッセージ (左下大) - ポストバック
  {
    bounds: { x: 0, y: 1460, width: 1435, height: 226 },
    action: {
      type: 'postback',
      label: '音声メッセージ',
      data: 'action=openVoice',
      inputOption: 'openVoice'
    }
  },
  
  // エリア7: キーボード展開 (中央下) - ポストバック
  {
    bounds: { x: 1435, y: 1460, width: 247, height: 226 },
    action: {
      type: 'postback',
      label: 'キーボード展開',
      data: 'action=openKeyboard',
      inputOption: 'openKeyboard'
    }
  },
  
  // エリア8: シェア (右下1)
  {
    bounds: { x: 1682, y: 1461, width: 516, height: 226 },
    action: {
      type: 'uri',
      label: 'シェア',
      uri: `https://line.me/R/nv/recommendOA/${CONFIG.botId}`
    }
  },
  
  // エリア9: マイページ (右下2) - 後でLIFF URIに変更予定
  {
    bounds: { x: 2198, y: 1461, width: 302, height: 226 },
    action: {
      type: 'message',
      label: 'マイページ',
      text: 'マイページ(準備中)' // ← 後で uri に変更
    }
  }
];

// ========== 🚀 リッチメニュー作成関数 ==========
async function createRichMenu(name, imagePath) {
  const headers = {
    'Authorization': `Bearer ${CONFIG.channelAccessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log(`\n📱 Creating Rich Menu: ${name}...`);
    
    const richMenuData = {
      size: {
        width: 2500,
        height: 1686
      },
      selected: true,
      name: name,
      chatBarText: 'メニューを開く',
      areas: richMenuAreas
    };

    const response = await axios.post(
      'https://api.line.me/v2/bot/richmenu',
      richMenuData,
      { headers }
    );
    
    const richMenuId = response.data.richMenuId;
    console.log(`✅ Created: ${richMenuId}`);
    
    // 画像をアップロード
    console.log(`🖼️  Uploading image: ${imagePath}...`);
    const imageBuffer = fs.readFileSync(imagePath);
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
    console.log('✅ Image uploaded');
    
    return richMenuId;
    
  } catch (error) {
    console.error(`❌ Error creating ${name}:`, error.response?.data || error.message);
    throw error;
  }
}

// ========== 🚀 メイン処理 ==========
async function setupDualRichMenus() {
  console.log('🚀 Miu Bot Dual Rich Menu Setup Start\n');
  
  const headers = {
    'Authorization': `Bearer ${CONFIG.channelAccessToken}`
  };
  
  try {
    // 既存のデフォルトリッチメニューを削除
    console.log('🗑️  Removing old default rich menu...');
    try {
      await axios.delete(
        'https://api.line.me/v2/bot/user/all/richmenu',
        { headers }
      );
      console.log('✅ Old menu removed');
    } catch (e) {
      console.log('ℹ️  No existing default menu');
    }

    // 1. 未入力版リッチメニュー作成
    const incompleteMenuId = await createRichMenu(
      'Miu メインメニュー (未入力)',
      CONFIG.imagePaths.incomplete
    );
    
    // 2. 完了版リッチメニュー作成
    const completeMenuId = await createRichMenu(
      'Miu メインメニュー (完了)',
      CONFIG.imagePaths.complete
    );
    
    // 3. 未入力版をデフォルトに設定
    console.log('\n⚙️  Setting incomplete menu as default...');
    await axios.post(
      `https://api.line.me/v2/bot/user/all/richmenu/${incompleteMenuId}`,
      {},
      { headers }
    );
    console.log('✅ Set as default');
    
    console.log('\n🎉 COMPLETE! Both rich menus created!');
    console.log('\n📋 Rich Menu IDs:');
    console.log(`┌─────────────────────────────────────────────┐`);
    console.log(`│ 🔴 未入力版 (⚠️マーク付き):               │`);
    console.log(`│ ${incompleteMenuId} │`);
    console.log(`├─────────────────────────────────────────────┤`);
    console.log(`│ 🟢 完了版 (⚠️マークなし):                 │`);
    console.log(`│ ${completeMenuId}   │`);
    console.log(`└─────────────────────────────────────────────┘`);
    
    console.log('\n⚠️  次のステップ:');
    console.log('1. Vercelの環境変数に以下を追加:');
    console.log(`   RICH_MENU_INCOMPLETE_ID=${incompleteMenuId}`);
    console.log(`   RICH_MENU_COMPLETE_ID=${completeMenuId}`);
    console.log('\n2. webhook.js にリッチメニュー切り替えロジックを追加');
    console.log('\n📱 メニュー構成（9エリア）:');
    console.log('  1. テンプレート (上部) → LIFF起動');
    console.log('  2. Miuとおしゃべり (左中) → /mode miu-chat');
    console.log('  3. カメラ翻訳 (中央中) → /camera-translate 📷');
    console.log('  4. 返信文作成 (右上) → /mode reply');
    console.log('  5. 翻訳選択 (右中) → /mode translate');
    console.log('  6. 音声メッセージ (左下大) → 音声入力 🎤');
    console.log('  7. キーボード展開 (中央下) → キーボード ⌨️');
    console.log('  8. シェア (右下1) → ボット紹介');
    console.log('  9. マイページ (右下2) → 準備中');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupDualRichMenus();