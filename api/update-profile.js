const { createClient } = require('@supabase/supabase-js');
const line = require('@line/bot-sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// プロフィール完成判定
function isProfileComplete(user) {
  return !!(
    user.preferred_name &&
    user.japanese_level &&
    user.residence_status &&
    user.prefecture
  );
}

module.exports = async (req, res) => {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId, preferred_name, japanese_level, residence_status, prefecture, language } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    // Supabaseを更新
    const updateData = {
      preferred_name,
      japanese_level,
      residence_status,
      prefecture,
      language,
      rich_menu_language: language,
    };

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ success: false, error: updateError.message });
    }

    // プロフィール完成度をチェック
    const isComplete = isProfileComplete(updatedUser);

    // リッチメニューIDを選択
    const richMenuId = isComplete
      ? (language === 'vi' ? process.env.RICH_MENU_VI_COMPLETE_ID : process.env.RICH_MENU_JA_COMPLETE_ID)
      : (language === 'vi' ? process.env.RICH_MENU_VI_INCOMPLETE_ID : process.env.RICH_MENU_JA_INCOMPLETE_ID);

    // リッチメニューを切り替え
    try {
      await client.linkRichMenuToUser(userId, richMenuId);
      console.log(`Rich menu updated: ${userId} -> ${richMenuId}`);
    } catch (richMenuError) {
      console.error('Rich menu update error:', richMenuError);
      // リッチメニュー更新失敗してもプロフィール更新は成功とする
    }

    // Supabaseのrich_menu_complete状態も更新
    await supabase
      .from('users')
      .update({ rich_menu_complete: isComplete })
      .eq('user_id', userId);

    return res.status(200).json({
      success: true,
      user: updatedUser,
      richMenuId,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
