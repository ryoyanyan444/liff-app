const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 環境変数から設定を読み込み
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

// ⭐ メインハンドラー
module.exports = async (req, res) => {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Line-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Webhook検証用
  if (req.method === 'GET') {
    return res.status(200).send('OK');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const events = req.body.events;

    if (!events || events.length === 0) {
      return res.status(200).json({ message: 'No events' });
    }

    // 各イベントを処理
    for (const event of events) {
      await handleEvent(event);
    }

    return res.status(200).json({ message: 'Success' });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ⭐ イベント処理
async function handleEvent(event) {
  // メッセージイベント以外は無視
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const userMessage = event.message.text;
  const replyToken = event.replyToken;

  try {
    // ユーザー情報取得
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    // ユーザーが存在しない場合は作成
    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          user_id: userId,
          plan: 'free',
          today_count: 0,
          vision_count: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      user = newUser;
    }

    // プラン制限チェック
    const plan = user?.plan || 'free';
    const todayCount = user?.today_count || 0;

    const limits = {
      free: 10,
      trial: -1,
      premium: -1
    };

    const limit = limits[plan] || 10;

    if (limit !== -1 && todayCount >= limit) {
      await client.replyMessage({
        replyToken: replyToken,
        messages: [{
          type: 'text',
          text: 'Bạn đã sử dụng hết giới hạn hôm nay 😢\n\n💎 Nâng cấp lên Premium để sử dụng không giới hạn!'
        }]
      });
      return;
    }

    // OpenAI API呼び出し
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Bạn là trợ lý AI thân thiện. Hãy trả lời bằng tiếng Việt một cách tự nhiên và hữu ích.'
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 500
    });

    const aiResponse = completion.choices[0].message.content;

    // 使用回数を更新
    await supabase
      .from('users')
      .update({ 
        today_count: todayCount + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    // 応答を送信
    await client.replyMessage({
      replyToken: replyToken,
      messages: [{
        type: 'text',
        text: aiResponse
      }]
    });

  } catch (error) {
    console.error('Event handling error:', error);
    
    // エラー時も返信
    try {
      await client.replyMessage({
        replyToken: replyToken,
        messages: [{
          type: 'text',
          text: 'Xin lỗi, đã có lỗi xảy ra 😢\nVui lòng thử lại sau.'
        }]
      });
    } catch (replyError) {
      console.error('Reply error:', replyError);
    }
  }
}
