const axios = require('axios');

const CHANNEL_ACCESS_TOKEN = 'QaI7weNXO+oZg5b+IQRCw9RbhaQ7sNW4/KNLzkbe8n/0kNoRL/XRswxiIMGhbqHR+HccG6Y5p2nRdPkbDaRtnsmf1U/id7UEnwwfABpFyZuGzpVB0d1WLIiBwousRunQ0SGjF7PyC4GNDOg5XyQAuAdB04t89/1O/w1cDnyilFU=';

async function deleteAllRichMenus() {
  const headers = {
    'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
  };

  try {
    console.log('🗑️  Deleting all rich menus...\n');

    // 1. デフォルトのリッチメニューを解除
    console.log('1️⃣ Removing default rich menu...');
    try {
      await axios.delete(
        'https://api.line.me/v2/bot/user/all/richmenu',
        { headers }
      );
      console.log('✅ Default rich menu removed\n');
    } catch (e) {
      console.log('ℹ️  No default rich menu\n');
    }

    // 2. すべてのリッチメニューを取得
    console.log('2️⃣ Getting all rich menus...');
    const response = await axios.get(
      'https://api.line.me/v2/bot/richmenu/list',
      { headers }
    );

    const richmenus = response.data.richmenus || [];
    console.log(`Found ${richmenus.length} rich menu(s)\n`);

    // 3. すべて削除
    if (richmenus.length > 0) {
      console.log('3️⃣ Deleting all rich menus...');
      for (const menu of richmenus) {
        console.log(`   Deleting: ${menu.richMenuId} (${menu.name})`);
        await axios.delete(
          `https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`,
          { headers }
        );
      }
      console.log(`✅ Deleted ${richmenus.length} rich menu(s)\n`);
    }

    console.log('🎉 All rich menus deleted!');
    console.log('Now run: node setup-richmenu.js');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

deleteAllRichMenus();
