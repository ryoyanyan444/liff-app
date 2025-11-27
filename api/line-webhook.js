const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 環境変数から設定を読み込み
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// ⭐ 新しいSDKの使い方に統一
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Vercel Serverless Function のエントリーポイント
module.exports = async (req, res) => {
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Line-Signature');

  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GETリクエストの処理（疎通確認用）
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'LINE Webhook endpoint is active' });
  }

  // POSTリクエスト以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // LINE署名検証
    const signature = req.headers['x-line-signature'];
    if (!signature) {
      console.error('No x-line-signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // ⭐ 署名検証を追加
    const body = JSON.stringify(req.body);
    const isValid = line.validateSignature(body, config.channelSecret, signature);
    
    if (!isValid) {
      console.error('Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // リクエストボディの取得
    const events = req.body.events;
    
    // 空のevents配列の場合（LINEプラットフォームからの疎通確認）
    if (!events || events.length === 0) {
      console.log('疎通確認リクエスト受信');
      return res.status(200).json({ message: 'OK' });
    }

    console.log('Webhook events received:', events.length);

    // 各イベントを処理（非同期処理）
    const promises = events.map(event => handleEvent(event));
    await Promise.all(promises);

    return res.status(200).json({ message: 'Success' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // エラーが発生してもLINEには200を返す（再送を防ぐため）
    return res.status(200).json({ message: 'Error handled' });
  }
};

// イベント処理関数
async function handleEvent(event) {
  console.log('Processing event:', event.type);

  // メッセージイベント以外は無視
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  // standbyモードの場合は処理しない
  if (event.mode === 'standby') {
    console.log('Standby mode - skipping');
    return null;
  }

  const userId = event.source.userId;
  const userMessage = event.message.text;
  const replyToken = event.replyToken;

  try {
    // ⭐ getProfile も新しいSDKに対応
    const profile = await client.getProfile(userId);
    console.log('User profile:', profile.displayName);

    // Supabaseでユーザー情報取得または作成
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userError || !user) {
      console.log('Creating new user');
      const { data: newUser } = await supabase
        .from('users')
        .insert([{
          user_id: userId,
          display_name: profile.displayName,
          plan: 'free',
          today_count: 0,  // ⭐ message_count から today_count に統一
          vision_count: 0,
          daily_limit: 5,
          last_reset_date: new Date().toISOString().split('T')[0]  // ⭐ 日付のみ保存
        }])
        .select()
        .single();
      
      user = newUser;
    }

    // ⭐ 日次リセット確認（簡略化）
    const today = new Date().toISOString().split('T')[0];
    
    if (user.last_reset_date !== today) {
      console.log('Daily reset triggered');
      await supabase
        .from('users')
        .update({
          today_count: 0,
          vision_count: 0,
          last_reset_date: today
        })
        .eq('user_id', userId);
      
      user.today_count = 0;
      user.vision_count = 0;
    }

    // 利用制限チェック
    const limits = {
      free: 10,      // ⭐ 他のファイルと統一
      trial: 50,
      premium: 999999
    };

    if (user.today_count >= limits[user.plan]) {
      console.log('Usage limit reached');
      // ⭐ 新しいSDKの返信方法
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{
          type: 'text',
          text: `本日の利用上限に達しました。\n\n現在のプラン: ${user.plan}\n本日の利用回数: ${user.today_count}/${limits[user.plan]}\n\nプレミアムプランにアップグレードすると無制限でご利用いただけます！`
        }]
      });
    }

    console.log('Calling OpenAI API');
    // OpenAI APIでベトナム語応答生成
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
    console.log('AI response generated');

    // メッセージカウント更新
    await supabase
      .from('users')
      .update({
        today_count: user.today_count + 1  // ⭐ カラム名を統一
      })
      .eq('user_id', userId);

    console.log('Sending reply to LINE');
    // ⭐ LINE返信（新しいSDK）
    return client.replyMessage({
      replyToken: replyToken,
      messages: [{
        type: 'text',
        text: aiResponse
      }]
    });

  } catch (error) {
    console.error('Event handling error:', error);
    
    // エラーメッセージを返信
    try {
      return client.replyMessage({
        replyToken: replyToken,
        messages: [{
          type: 'text',
          text: 'エラーが発生しました。しばらくしてからもう一度お試しください。'
        }]
      });
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}