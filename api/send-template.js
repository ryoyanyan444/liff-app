const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId, templateId } = req.body;

    if (!userId || !templateId) {
      return res.status(400).json({ success: false, error: 'Missing userId or templateId' });
    }

    // ⭐ テンプレート取得（カラム名はテーブル定義に合わせる）
    const { data: template, error } = await supabase
      .from('templates')
      .select('id, display_label, message')
      .eq('id', templateId)
      .single();

    if (error || !template) {
      console.error('Template fetch error:', error);
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    // ⭐ LINEにテンプレートメッセージ送信
    await client.pushMessage({
      to: userId,
      messages: [
        {
          type: 'text',
          text: `📋 ${template.display_label}\n\n${template.message}\n\n続けて内容を送信してください。`
        }
      ]
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Send template error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
