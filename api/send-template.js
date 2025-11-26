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
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // OPTIONSリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, templateId } = req.body;

    if (!userId || !templateId) {
      return res.status(400).json({ error: 'Missing userId or templateId' });
    }

    // テンプレート取得
    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // LINEにテンプレートメッセージを送信
    await client.pushMessage({
      to: userId,
      messages: [
        {
          type: 'text',
          text: `📋 ${template.title}\n\n${template.prompt}\n\n続けて内容を送信してください。`
        }
      ]
    });

    return res.status(200).json({ success: true, message: 'Template sent' });

  } catch (error) {
    console.error('Send template error:', error);
    return res.status(500).json({ error: error.message });
  }
};