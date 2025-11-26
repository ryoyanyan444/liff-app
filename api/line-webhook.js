const line = require('@line/bot-sdk');
const { Configuration, OpenAI } = require('openai');
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

// プラン別の制限
const PLAN_LIMITS = {
  free: { daily: 10, vision: 3 },
  trial: { daily: 50, vision: 20 },
  premium: { daily: 999999, vision: 999999 }
};

// GPTモデル設定
const GPT_MODEL = 'gpt-4o-mini';
const VISION_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 16000;
const RESPONSE_TOKENS = 4000;

// システムプロンプト
const SYSTEM_PROMPT = `あなたは親切で知識豊富なAIアシスタントです。ベトナム語で自然に会話してください。

重要なルール:
1. 常にベトナム語で応答する
2. 丁寧で親しみやすい口調を使う
3. 質問には具体的に答える
4. 必要に応じて例を示す
5. 長すぎる回答は避け、要点を簡潔に伝える`;

// ユーザー情報取得・作成
async function getOrCreateUser(userId, displayName) {
  try {
    // ユーザー取得
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // ユーザーが存在しない場合は作成
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            user_id: userId,
            display_name: displayName,
            plan: 'free',
            today_count: 0,
            vision_count: 0,
            last_reset_date: new Date().toISOString().split('T')[0]
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      return newUser;
    }

    if (error) throw error;

    // 日付リセットチェック
    const today = new Date().toISOString().split('T')[0];
    if (user.last_reset_date !== today) {
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          today_count: 0,
          vision_count: 0,
          last_reset_date: today
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedUser;
    }

    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw error;
  }
}

// 使用回数チェック
function checkUsageLimit(user, isVision = false) {
  const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
  
  if (user.today_count >= limits.daily) {
    return {
      allowed: false,
      message: `Bạn đã sử dụng hết ${limits.daily} tin nhắn hôm nay.\n\n💎 Nâng cấp lên Premium để sử dụng không giới hạn!`
    };
  }

  if (isVision && user.vision_count >= limits.vision) {
    return {
      allowed: false,
      message: `Bạn đã sử dụng hết ${limits.vision} lần phân tích hình ảnh hôm nay.\n\n💎 Nâng cấp lên Premium để sử dụng không giới hạn!`
    };
  }

  return { allowed: true };
}

// 使用回数更新
async function incrementUsage(userId, isVision = false) {
  try {
    const updateData = { today_count: supabase.rpc('increment', { x: 1 }) };
    if (isVision) {
      updateData.vision_count = supabase.rpc('increment', { x: 1 });
    }

    await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error incrementing usage:', error);
  }
}

// 会話履歴取得
async function getConversationHistory(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('conversation_history')
      .select('role, content, tokens')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // 逆順にして返す（古い順）
    return (data || []).reverse();
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

// 会話履歴保存
async function saveMessage(userId, role, content, tokens = 0) {
  try {
    await supabase
      .from('conversation_history')
      .insert([
        {
          user_id: userId,
          role: role,
          content: content,
          tokens: tokens
        }
      ]);
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

// トークン数推定
function estimateTokens(text) {
  return Math.ceil(text.length / 3);
}

// 会話履歴のトリミング
function trimConversationHistory(messages, maxTokens) {
  let totalTokens = 0;
  const trimmedMessages = [];

  // 新しいメッセージから逆順で追加
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = msg.tokens || estimateTokens(msg.content);
    
    if (totalTokens + tokens > maxTokens) {
      break;
    }
    
    totalTokens += tokens;
    trimmedMessages.unshift(msg);
  }

  return trimmedMessages;
}

// Quick Reply生成
function generateQuickReply() {
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '💬 Trò chuyện mới',
          text: 'Bắt đầu cuộc trò chuyện mới'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📊 Thông tin tài khoản',
          text: 'Xem thông tin tài khoản của tôi'
        }
      },
      {
        type: 'action',
        action: {
          type: 'uri',
          label: '💎 Nâng cấp Premium',
          uri: process.env.LIFF_URL || 'https://liff.line.me/2008551240-vWN36gzR'
        }
      }
    ]
  };
}

// OpenAI API呼び出し
async function callOpenAI(messages, isVision = false) {
  const model = isVision ? VISION_MODEL : GPT_MODEL;
  
  const response = await openai.chat.completions.create({
    model: model,
    messages: messages,
    max_tokens: RESPONSE_TOKENS,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

// メイン処理
module.exports = async (req, res) => {
  // Webhook検証
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
      if (event.type !== 'message') continue;

      const userId = event.source.userId;
      const replyToken = event.replyToken;

      // プロフィール取得
      let profile;
      try {
        profile = await client.getProfile(userId);
      } catch (error) {
        console.error('Error getting profile:', error);
        profile = { displayName: 'User' };
      }

      // ユーザー情報取得・作成
      const user = await getOrCreateUser(userId, profile.displayName);

      // メッセージタイプ判定
      const isVision = event.message.type === 'image';
      const isText = event.message.type === 'text';

      if (!isText && !isVision) {
        await client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: 'Xin lỗi, tôi chỉ có thể xử lý tin nhắn văn bản và hình ảnh.'
            }
          ]
        });
        continue;
      }

      // 使用制限チェック
      const usageCheck = checkUsageLimit(user, isVision);
      if (!usageCheck.allowed) {
        await client.replyMessage({
          replyToken: replyToken,
          messages: [
            {
              type: 'text',
              text: usageCheck.message,
              quickReply: generateQuickReply()
            }
          ]
        });
        continue;
      }

      // ローディングメッセージ送信
      await client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: '⏳ Đang xử lý...'
          }
        ]
      });

      try {
        let userMessage;
        let messages = [{ role: 'system', content: SYSTEM_PROMPT }];

        if (isVision) {
          // 画像処理
          const messageContent = await client.getMessageContent(event.message.id);
          const chunks = [];
          
          for await (const chunk of messageContent) {
            chunks.push(chunk);
          }
          
          const buffer = Buffer.concat(chunks);
          const base64Image = buffer.toString('base64');

          userMessage = 'Phân tích hình ảnh này';
          
          messages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                text: userMessage
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          });
        } else {
          // テキスト処理
          userMessage = event.message.text;

          // 会話履歴取得
          const history = await getConversationHistory(userId, 10);
          const trimmedHistory = trimConversationHistory(history, MAX_TOKENS - RESPONSE_TOKENS - 500);

          // メッセージ構築
          messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...trimmedHistory.map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: userMessage }
          ];
        }

        // OpenAI API呼び出し
        const aiResponse = await callOpenAI(messages, isVision);

        // 会話履歴保存
        const userTokens = estimateTokens(userMessage);
        const aiTokens = estimateTokens(aiResponse);
        
        await saveMessage(userId, 'user', userMessage, userTokens);
        await saveMessage(userId, 'assistant', aiResponse, aiTokens);

        // 使用回数更新
        await incrementUsage(userId, isVision);

        // 応答送信
        await client.pushMessage({
          to: userId,
          messages: [
            {
              type: 'text',
              text: aiResponse,
              quickReply: generateQuickReply()
            }
          ]
        });

      } catch (error) {
        console.error('Error processing message:', error);
        await client.pushMessage({
          to: userId,
          messages: [
            {
              type: 'text',
              text: 'Xin lỗi, đã xảy ra lỗi khi xử lý tin nhắn của bạn. Vui lòng thử lại sau.'
            }
          ]
        });
      }
    }

    return res.status(200).json({ message: 'Success' });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};