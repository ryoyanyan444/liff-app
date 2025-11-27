const { Client } = require('@line/bot-sdk');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 環境変数から設定を読み込み
const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// CORSヘッダー設定
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Line-Signature');
}

// メインハンドラー
module.exports = async (req, res) => {
  setCORSHeaders(res);

  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POSTリクエスト以外は拒否
  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'OK' });
  }

  try {
    const events = req.body.events;

    // イベントがない場合
    if (!events || events.length === 0) {
      return res.status(200).json({ message: 'No events' });
    }

    // 各イベントを処理
    await Promise.all(events.map(handleEvent));

    return res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ message: 'Error handled' });
  }
};

// イベント処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const userMessage = event.message.text;

  try {
    // ユーザープロフィール取得
    const profile = await client.getProfile(userId);

    // Supabaseでユーザー情報取得または作成
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userError || !user) {
      // 新規ユーザー作成
      const { data: newUser } = await supabase
        .from('users')
        .insert([{
          user_id: userId,
          display_name: profile.displayName,
          plan: 'free',
          message_count: 0,
          daily_limit: 5,
          last_reset: new Date().toISOString()
        }])
        .select()
        .single();
      
      user = newUser;
    }

    // 日次リセット確認
    const lastReset = new Date(user.last_reset);
    const now = new Date();
    if (now.getDate() !== lastReset.getDate()) {
      await supabase
        .from('users')
        .update({
          message_count: 0,
          last_reset: now.toISOString()
        })
        .eq('user_id', userId);
      
      user.message_count = 0;
    }

    // 利用制限チェック
    const limits = {
      free: 5,
      trial: 50,
      premium: 999999
    };

    if (user.message_count >= limits[user.plan]) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `本日の利用上限に達しました。\n\n現在のプラン: ${user.plan}\n本日の利用回数: ${user.message_count}/${limits[user.plan]}\n\nプレミアムプランにアップグレードすると無制限でご利用いただけます！`
      });
    }

    // OpenAI APIでベトナム語応答生成
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'あなたはベトナム語学習を支援するAIアシスタントです。ユーザーの質問に対してベトナム語で回答してください。'
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;

    // メッセージカウント更新
    await supabase
      .from('users')
      .update({
        message_count: user.message_count + 1
      })
      .eq('user_id', userId);

    // LINE返信
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiResponse
    });

  } catch (error) {
    console.error('Event handling error:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'エラーが発生しました。しばらくしてからもう一度お試しください。'
    });
  }
}
