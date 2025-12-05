const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ===============================
// モード定義
// ===============================
const MODES = {
  STANDARD: 'standard',
  TRANSLATE: 'translate',
  MIU_CHAT: 'miu-chat',
  REPLY: 'reply',
  HOMEWORK: 'homework',
  REPORT: 'report',
  IMAGE_ANIME: 'image-anime',
};

const MODE_LABELS = {
  [MODES.STANDARD]: 'お悩みモード',
  [MODES.TRANSLATE]: '翻訳モード',
  [MODES.MIU_CHAT]: 'Miu雑談モード',
  [MODES.REPLY]: '返信文作成モード',
  [MODES.HOMEWORK]: '宿題モード',
  [MODES.REPORT]: 'レポートモード',
  [MODES.IMAGE_ANIME]: '画像→アニメ風変換',
};

// 返信スタイル定義
const REPLY_STYLES = {
  'best-friend': {
    label: '🤗 親友',
    description: 'タメ口、絵文字多め、フレンドリー'
  },
  'friend': {
    label: '😊 友達',
    description: '丁寧だけど親しみやすい'
  },
  'senior': {
    label: '🙇 先輩・目上',
    description: '敬語、丁寧、礼儀正しい'
  },
  'ninja': {
    label: '🥷 元気な忍者風', // ✅ 変更
    description: '熱血で前向き、エネルギッシュ'
  },
  'pirate': {
    label: '🏴‍☠️ 自由な冒険者風', // ✅ 変更
    description: '明るく自由、仲間思い'
  }
};

// ===============================
// アニメスタイル定義（作品の世界観・タッチ）
// ===============================
const ANIME_STYLES = {
  'fujiko-touch': {
    label: '🔵 藤子タッチ',
    description: '丸くて優しい線、温かい日常の雰囲気、昭和レトロな世界観',
    prompt: 'Fujiko Fujio manga art style, round soft shapes, warm everyday life atmosphere, gentle curved lines, simple clean design, bright pastel colors, nostalgic Showa-era Japan feeling, heartwarming slice-of-life scenes, characteristic simple rounded character designs'
  },
  'mystery-manga': {
    label: '🔍 推理マンガタッチ',
    description: '鋭い線、ミステリアスな雰囲気、都会的でスタイリッシュな世界観',
    prompt: 'Detective mystery manga art style, sharp precise lines, dramatic shadows and lighting, urban modern setting, intellectual atmosphere, realistic proportions with manga stylization, noir aesthetic, suspenseful mood, detailed backgrounds'
  },
    'ninja-battle': {
    label: '🥷 忍者バトルタッチ',
    description: '躍動感ある線、エネルギッシュな世界観、熱血アクション',
    prompt: 'Masashi Kishimoto manga art style, clean sharp linework with dynamic motion, expressive large eyes with detailed highlights, spiky hair with precise angular shapes, detailed fabric folds and movement, dramatic action poses with speed lines, high-contrast black and white shading, shounen manga aesthetic from 2000s, ninja theme with explosive energy effects, characteristic Kishimoto facial expressions and anatomy, professional manga illustration quality'
  },
  'adventure-manga': {
    label: '🏴‍☠️ 冒険マンガタッチ',
    description: '大胆でダイナミックな線、明るく元気な世界観、海賊冒険',
    prompt: 'One Piece anime art style by Eiichiro Oda, highly exaggerated cartoon proportions with stretched limbs, straw hat, bright sunny tropical colors, bold dynamic thick lines, extremely energetic cheerful expressions with wide grins, deformed character design with large heads, ocean adventure pirate theme, freedom and friendship aesthetic, vibrant red vest and blue shorts, scar under left eye, determined optimistic facial expression, comedic action poses' // ✅ ルフィ特有の要素を強化
  },
  'fantasy-watercolor': {
    label: '🌿 ファンタジー水彩タッチ',
    description: '繊細な手描き感、自然光と緑豊かな世界観、夢のような雰囲気',
    prompt: 'Studio Ghibli-inspired fantasy watercolor art style, soft hand-painted aesthetic, lush detailed nature backgrounds, gentle natural lighting, dreamy peaceful atmosphere, realistic environmental details, nostalgic countryside feeling, detailed clouds and foliage, warm earth tones'
  },
};

// ===============================
// 画像サイズ定義
// ===============================
const IMAGE_SIZES = {
  'square': { label: '🟦 正方形(1:1)', size: '1024x1024' },
  'landscape': { label: '🟥 横長(16:9)', size: '1792x1024' },
  'portrait': { label: '🟩 縦長(9:16)', size: '1024x1792' }
};

// ===============================
// 🌐 Webhook エンドポイント
// ===============================
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const events = req.body.events;
    console.log('📦 Webhook received:', events);

    await Promise.all(
      events.map((event) => handleEvent(event).catch((err) => {
        console.error('❌ Event processing error:', err);
        return null;
      }))
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===============================
// handleEvent 内に追加
// ===============================
async function handleEvent(event) {
  console.log('Processing event:', event.type);

  if (event.type === 'postback') {
    return await handlePostback(event);
  }

  if (event.type !== 'message') return null;
  if (event.mode === 'standby') {
    console.log('Standby mode - skipping');
    return null;
  }

  const messageType = event.message.type;
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const userMessage = messageType === 'text' ? (event.message.text || '') : '';

  try {
    const profile = await client.getProfile(userId);
    console.log('User profile:', profile.displayName);

    let user = await getOrCreateUser(userId, profile.displayName);
    user = await handleDailyReset(user, userId);

    const currentMode = user.mode || MODES.MIU_CHAT;
    const plan = user.plan || 'free';
    const todayCount = user.today_count ?? 0;
    const limits = {
      free: 10,
      trial: 999999,
      premium: 999999
    };

    if (messageType === 'text') {
      const text = userMessage.trim();

      if (text.startsWith('/set_level_')) {
        return await handleLevelSetting(text, userId, replyToken, user);
      }

      if (!user.japanese_level) {
        return await promptJapaneseLevel(replyToken);
      }

      if (todayCount >= (limits[plan] || limits.free)) {
        return await sendUsageLimitMessage(replyToken, plan, todayCount, limits);
      }

      if (text.startsWith('/mode ')) {
        return await handleModeCommand(text, userId, replyToken, user);
      }

      if (text.startsWith('/reply_style ')) {
        return await handleReplyStyleCommand(text, userId, replyToken, user);
      }

      // ✅ アニメスタイル選択コマンド処理を追加
      if (text.startsWith('/anime_style ')) {
        return await handleAnimeStyleCommand(text, userId, replyToken, user);
      }

       if (text.startsWith('/image_size ')) {
      return await handleImageSizeCommand(text, userId, replyToken, user);
    }

      await showLoadingAnimation(userId);
      await incrementUsageCount(userId);

      return await callOpenAI(userMessage, currentMode, user, replyToken, userId);
    }

    if (messageType === 'image') {
  if (!user.japanese_level) {
    return await promptJapaneseLevel(replyToken);
  }

  if (todayCount >= (limits[plan] || limits.free)) {
    return await sendUsageLimitMessage(replyToken, plan, todayCount, limits);
  }

  console.log('📸 Image received');
  console.log('Current mode:', currentMode);
  console.log('User anime_style:', user.anime_style);
  console.log('User image_size:', user.image_size);

  // ✅ IMAGE_ANIMEモードかつ選択画面を表示する場合はローディングとカウントをスキップ
  if (currentMode === MODES.IMAGE_ANIME && (!user.anime_style || !user.image_size)) {
    console.log('✅ Showing selection screen WITHOUT loading and count');
    return await handleImageProcessing(event.message.id, currentMode, user, replyToken, userId);
  }

  // ✅ スタイルとサイズが両方選択済みの場合のみローディングとカウント
  console.log('🎨 Processing image WITH loading animation and count');
  await showLoadingAnimation(userId);
  await incrementUsageCount(userId);

  return await handleImageProcessing(event.message.id, currentMode, user, replyToken, userId);
}

    console.log('Unsupported message type:', messageType);
    return null;

  } catch (error) {
    console.error('Event handling error:', error);
    const errMsg = (error && (error.message || JSON.stringify(error))) || '詳細不明のエラー';

    try {
      return client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: `エラーが発生しました:\n${errMsg}` }],
      });
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

// ===============================
// 🔄 Postback処理
// ===============================
async function handlePostback(event) {
  const userId = event.source.userId;
  const postbackData = event.postback.data;

  console.log('📮 Postback received:', postbackData);

  try {
    // JSON形式（コピーボタン）
    if (postbackData.startsWith('{')) {
      const data = JSON.parse(postbackData);

      if (data.action === 'copy_ja' || data.action === 'copy_vi') {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: data.text }],
        });
        console.log('✅ Copy action completed:', data.action);
        return;
      }
    }

    // クエリパラメータ形式（モード切替）
    const params = new URLSearchParams(postbackData);
    const action = params.get('action');
    const mode = params.get('mode');

    if (action === 'switch_mode' && mode) {
      await supabase.from('users').update({ mode: mode }).eq('user_id', userId);

      const modeLabels = {
        'miu-chat': '✨ Miuとの会話モード',
        translate: '🌐 翻訳モード',
        reply: '💬 返信生成モード',
        homework: '📝 宿題サポートモード',
        'image-anime': '🎨 画像生成モード',
      };

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `${modeLabels[mode] || mode}に切り替えました！` }],
      });
      return;
    }

    // open_keyboard, open_voiceは無視
    if (action === 'open_keyboard' || action === 'open_voice') {
      console.log('ℹ️ Keyboard/Voice action - no reply needed');
      return;
    }

  } catch (error) {
    console.error('❌ Postback processing error:', error);
  }
}

// ===============================
// ユーザー管理
// ===============================
async function getOrCreateUser(userId, displayName) {
  try {
    const { data } = await supabase.from('users').select('*').eq('user_id', userId).maybeSingle();
    if (data) return data;
  } catch (e) {
    console.error('Supabase select exception:', e);
  }

  const jstOffset = 9 * 60;
  const now = new Date();
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  const today = jstTime.toISOString().split('T')[0];

  const newUser = {
    user_id: userId,
    display_name: displayName,
    plan: 'free',
    today_count: 0,
    vision_count: 0,
    daily_limit: 10,
    last_reset_date: today,
    mode: MODES.MIU_CHAT,
    japanese_level: null,
    reply_style: 'friend',
    anime_style: 'ninja-battle', 
      image_size: 'null', // ✅ 追加
  };

  try {
    const { data } = await supabase.from('users').insert([newUser]).select().single();
    return data || newUser;
  } catch (e) {
    return newUser;
  }
}

async function handleDailyReset(user, userId) {
  const jstOffset = 9 * 60;
  const now = new Date();
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  const today = jstTime.toISOString().split('T')[0];

  let lastReset = null;
  if (user.last_reset_date) {
    lastReset = String(user.last_reset_date).split('T')[0];
  }

  if (lastReset !== today) {
    user.today_count = 0;
    user.vision_count = 0;
    user.last_reset_date = today;

    await supabase.from('users').update({
      today_count: 0,
      vision_count: 0,
      last_reset_date: today
    }).eq('user_id', userId);
  }

  return user;
}

async function incrementUsageCount(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('today_count')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    const newCount = (data.today_count || 0) + 1;

    await supabase
      .from('users')
      .update({ today_count: newCount })
      .eq('user_id', userId);

    console.log(`✅ Usage count incremented: ${newCount}`);
  } catch (e) {
    console.error('❌ Usage count increment error:', e);
  }
}

// ===============================
// コマンド処理
// ===============================
async function handleLevelSetting(text, userId, replyToken, user) {
  let level = 'beginner';
  let label = 'かんたんな日本語';

  if (text === '/set_level_middle') {
    level = 'middle';
    label = 'ふつうか少しむずかしい日本語';
  }
  if (text === '/set_level_advanced') {
    level = 'advanced';
    label = 'ふつうの日本語';
  }

  await supabase.from('users').update({ japanese_level: level }).eq('user_id', userId);

  return client.replyMessage({
    replyToken,
    messages: [{ type: 'text', text: `日本語レベルを「${label}」に設定したよ✨\n\nこれからは、そのレベルに合わせて\nやさしい日本語(🟢)で答えるね💚` }],
  });
}

async function promptJapaneseLevel(replyToken) {
  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'text',
      text: 'はじめまして!Miuだよ😊\n\nあなたの日本語レベルをおしえてね💕',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: 'ほとんどわからない', text: '/set_level_beginner' } },
          { type: 'action', action: { type: 'message', label: 'ゆっくりならだいたいわかる', text: '/set_level_middle' } },
          { type: 'action', action: { type: 'message', label: 'ふつうの日本語でだいじょうぶ', text: '/set_level_advanced' } },
        ],
      },
    }],
  });
}

async function sendUsageLimitMessage(replyToken, plan, todayCount, limits) {
  const pricingUrl = 'https://liff.line.me/2008551240-vWN36gzR';

  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'flex',
      altText: '利用上限に達しました',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '利用上限に達しました🙏', weight: 'bold', size: 'xl', color: '#DA251D', wrap: true },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: '現在のプラン', color: '#aaaaaa', size: 'sm', flex: 2 },
                    { type: 'text', text: plan, color: '#666666', size: 'sm', flex: 3 }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: '本日の利用回数', color: '#aaaaaa', size: 'sm', flex: 2 },
                    { type: 'text', text: `${todayCount}/${limits[plan]}`, color: '#666666', size: 'sm', flex: 3 }
                  ]
                }
              ]
            },
            { type: 'separator', margin: 'lg' },
            { type: 'text', text: 'プレミアムプランなら無制限でご利用いただけます✨', wrap: true, color: '#666666', size: 'sm', margin: 'lg' }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              color: '#fab536',
              action: { type: 'uri', label: '料金プランを見る💰', uri: pricingUrl }
            },
            {
              type: 'button',
              style: 'link',
              height: 'sm',
              action: { type: 'uri', label: '明日また来てね🌸', uri: 'https://line.me/R/ti/p/@687hoviz' }
            }
          ]
        }
      }
    }],
  });
}

async function handleModeCommand(text, userId, replyToken, user) {
  const arg = text.replace('/mode ', '').trim();

  if (arg === 'reply') {
    await Promise.all([
      sendReplyStyleSelection(replyToken),
      supabase.from('users').update({ mode: MODES.REPLY }).eq('user_id', userId)
    ]);
    return;
  }

  const modes = {
    'standard': MODES.STANDARD,
    'translate': MODES.TRANSLATE,
    'miu-chat': MODES.MIU_CHAT,
    'homework': MODES.HOMEWORK,
    'report': MODES.REPORT,
    'image': MODES.IMAGE_ANIME,
  };

  const nextMode = modes[arg];
  
  if (!nextMode) {
    return client.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: '切り替えできるモード:\n' +
              '/mode standard → お悩みモード\n' +
              '/mode translate → 翻訳モード\n' +
              '/mode miu-chat → Miu雑談\n' +
              '/mode reply → 返信文作成\n' +
              '/mode homework → 宿題モード\n' +
              '/mode report → レポートモード\n' +
              '/mode image → 画像生成モード'
      }],
    });
  }

  // ✅ IMAGE_ANIME モードの場合は先に return
  if (nextMode === MODES.IMAGE_ANIME) {
    await supabase.from('users').update({ mode: MODES.IMAGE_ANIME }).eq('user_id', userId);
    return sendAnimeStyleSelection(replyToken);
  }

  // ✅ 他のモードの場合は Supabase 更新
  await supabase.from('users').update({ mode: nextMode }).eq('user_id', userId);

  let responseText = `モードを「${MODE_LABELS[nextMode]}」に変更しました💚`;
  let quickReply = null;

  switch (nextMode) {
    case MODES.TRANSLATE:
      responseText = `モードを「${MODE_LABELS[nextMode]}」に変更しました🌸\n\n難しい日本語の文書や写真を送ってね✨\nベトナム語と、やさしい日本語で説明するよ💚`;
      quickReply = {
        items: [
          { type: 'action', action: { type: 'message', label: 'テキストから', text: 'テキストで翻訳を送る' } },
          { type: 'action', action: { type: 'camera', label: 'カメラから' } },
          { type: 'action', action: { type: 'cameraRoll', label: 'アルバムから' } },
        ],
      };
      break;

    case MODES.HOMEWORK:
      responseText = `モードを「${MODE_LABELS[nextMode]}」に変更しました📝\n\n宿題を送る方法を選んでね💕`;
      quickReply = {
        items: [
          { type: 'action', action: { type: 'message', label: 'テキストから', text: 'テキストで宿題を送る' } },
          { type: 'action', action: { type: 'camera', label: 'カメラから' } },
          { type: 'action', action: { type: 'cameraRoll', label: 'アルバムから' } },
        ],
      };
      break;

    case MODES.REPORT:
      responseText = `モードを「${MODE_LABELS[nextMode]}」に変更しました📄\n\nレポートを送る方法を選んでね💕`;
      quickReply = {
        items: [
          { type: 'action', action: { type: 'message', label: 'テキストから', text: 'テキストでレポート内容を送る' } },
          { type: 'action', action: { type: 'camera', label: 'カメラから' } },
          { type: 'action', action: { type: 'cameraRoll', label: 'アルバムから' } },
        ],
      };
      break;

    case MODES.STANDARD:
      responseText = `モードを「${MODE_LABELS[nextMode]}」に変更しました💚\n\n日本での困りごとを相談してね🍀`;
      break;

    case MODES.MIU_CHAT:
      responseText = `モードを「${MODE_LABELS[nextMode]}」に変更しました🐱💕\n\nMiuとおしゃべりしよう✨\n日本での生活、どう?😊`;
      break;

    default:
      break;
  }

  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'text',
      text: responseText,
      ...(quickReply ? { quickReply } : {}),
    }],
  });
}

async function handleAnimeStyleCommand(text, userId, replyToken, user) {
  const styleKey = text.replace('/anime_style ', '').trim();
  const style = ANIME_STYLES[styleKey];

  if (!style) {
    return client.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: '選択できるタッチ:\n🔵 藤子タッチ\n🔍 推理マンガタッチ\n🥷 忍者バトルタッチ\n🏴‍☠️ 冒険マンガタッチ\n🌿 ファンタジー水彩タッチ'
      }],
    });
  }

  // ユーザーの選択したスタイルをSupabaseに保存
  try {
    await supabase
      .from('users')
      .update({ anime_style: styleKey })
      .eq('user_id', userId);

    console.log(`✅ Anime style set to: ${styleKey} for user: ${userId}`);
  } catch (e) {
    console.error('Supabase anime_style update error:', e);
  }

  // ✅ 修正: 写真送信を促すメッセージ
  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'text',
      text: `${style.label} を選択しました✨\n\n【このタッチの特徴】\n${style.description}\n\n📸 変換したい写真を送ってね！\n写真を受け取ったら、サイズを選べるよ😊`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'camera', label: '📷 写真を撮る' } },
          { type: 'action', action: { type: 'cameraRoll', label: '🖼️ アルバムから' } },
        ],
      },
    }],
  });
}

async function handleImageSizeCommand(text, userId, replyToken, user) {
  const sizeKey = text.replace('/image_size ', '').trim();
  const sizeObj = IMAGE_SIZES[sizeKey];

  if (!sizeObj) {
    return client.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: '選択できるサイズ:\n🟦 正方形(1:1)\n🟥 横長(16:9)\n🟩 縦長(9:16)'
      }],
    });
  }

  // ユーザーの選択したサイズをSupabaseに保存
  try {
    await supabase
      .from('users')
      .update({ image_size: sizeKey })
      .eq('user_id', userId);

    console.log(`✅ Image size set to: ${sizeKey} for user: ${userId}`);
  } catch (e) {
    console.error('Supabase image_size update error:', e);
  }

  // ✅ 保存された画像があれば処理を開始
  if (user.pending_image_id && user.pending_image_base64) {
    console.log('🎨 Processing saved image...');
    
    // ローディングアニメーション表示
    await showLoadingAnimation(userId);

    // 選択されたスタイルとサイズで画像を処理
    const selectedStyleKey = user.anime_style || 'ninja-battle';
    const selectedStyle = ANIME_STYLES[selectedStyleKey];
    const base64Image = user.pending_image_base64;

    try {
      // Step 1: 画像の内容を理解
      const analysisCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'この画像を詳しく説明してください。人物の特徴、表情、服装、背景、雰囲気などを含めて、英語で簡潔に説明してください。',
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              },
            ],
          },
        ],
        max_tokens: 300,
      });

      const imageDescription = analysisCompletion.choices[0].message.content;
      console.log('📝 Image description:', imageDescription);

      // Step 2: 選択されたスタイル&サイズで画像生成
      const prompt = `${selectedStyle.prompt}. Subject: ${imageDescription}. \nHigh quality anime illustration, professional art, detailed and expressive.`;

      const imageResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: sizeObj.size,
        quality: 'standard',
      });

      const generatedImageUrl = imageResponse.data[0].url;
      console.log('✅ Anime image generated:', generatedImageUrl);

      // 一時保存データをクリア
      await supabase
        .from('users')
        .update({ 
          pending_image_id: null,
          pending_image_base64: null 
        })
        .eq('user_id', userId);

      return client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `🎨 ${selectedStyle.label} × ${sizeObj.label} で変換しました✨\n\n元の写真の特徴を活かしながら、選択されたアニメ風イラストにしたよ💕`,
          },
          {
            type: 'image',
            originalContentUrl: generatedImageUrl,
            previewImageUrl: generatedImageUrl,
          },
        ],
      });
    } catch (error) {
      console.error('❌ Image generation error:', error);
      
      return client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: '画像生成中にエラーが発生しました💦\n\nもう一度写真を送ってみてください😊',
        }],
      });
    }
  }

  // ✅ 保存された画像がない場合(テキスト生成用)
  const selectedStyleKey = user.anime_style || 'ninja-battle';
  const selectedStyle = ANIME_STYLES[selectedStyleKey];

  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'text',
      text: `✅ 設定完了!\n\n【タッチ】${selectedStyle.label}\n【サイズ】${sizeObj.label}\n\n説明文を送ってね✨\n\n例: 「桜の下で笑顔の女の子」`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '例文を試す', text: '桜の下で笑顔の女の子' } },
        ],
      },
    }],
  });
}

async function sendReplyStyleSelection(replyToken) {
  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'flex',
      altText: '返信スタイルを選んでね',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '返信文作成モード✏️', weight: 'bold', size: 'xl', color: '#1DB446' },
            { type: 'text', text: 'どんな話し方で返信する?', size: 'sm', color: '#999999', margin: 'md' },
            { type: 'separator', margin: 'lg' },
            ...Object.entries(REPLY_STYLES).map(([key, style]) => ({
              type: 'button',
              style: 'link',
              height: 'sm',
              action: { type: 'message', label: style.label, text: `/reply_style ${key}` },
            })),
          ],
        },
      },
    }],
  });
}

async function handleReplyStyleCommand(text, userId, replyToken, user) {
  const styleKey = text.replace('/reply_style ', '').trim();
  const style = REPLY_STYLES[styleKey];

  if (!style) {
    return client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: '選択できるスタイル:\nしんゆう、ともだち、せんぱい、ナルト風、ルフィ風' }],
    });
  }

  await supabase.from('users').update({ reply_style: styleKey }).eq('user_id', userId);

  return client.replyMessage({
    replyToken,
    messages: [{ type: 'text', text: `返信スタイルを「${style.label}」に設定したよ✨\n\n返信してほしいメッセージを送ってね😊` }],
  });
}

// ===============================
// OpenAI呼び出し
// ===============================
async function callOpenAI(userMessage, mode, user, replyToken, userId) {
  if (mode === MODES.IMAGE_ANIME) {
    try {
      console.log('🎨 Starting text-to-image generation...');

      // ✅ ユーザーが選択したスタイルを取得
      const selectedStyleKey = user.anime_style || 'ninja-battle'; // ✅ デフォルトを修正
      const selectedStyle = ANIME_STYLES[selectedStyleKey];

      if (!selectedStyle) {
        console.error(`❌ Unknown anime style: ${selectedStyleKey}`);
        return await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: `アニメスタイルの設定にエラーがありました💦\n\n選択: ${selectedStyleKey}\n\n/mode image でスタイルを選び直してください😊`,
          }],
        });
      }

      console.log(`🎨 Using style: ${selectedStyle.label}`);

      // 日本語を英語に翻訳してプロンプト作成
      const translationCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは日本語を英語に翻訳する専門家です。ユーザーの説明を、DALL-E用の詳細な画像生成プロンプトに変換してください。',
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      const translatedDescription = translationCompletion.choices[0].message.content;
      console.log('📝 Translated description:', translatedDescription);

      // DALL-E 3で選択されたスタイルの画像を生成
      const prompt = `${selectedStyle.prompt}. Subject: ${translatedDescription}. High quality anime illustration, professional art, detailed and expressive.`;

      const selectedSizeKey = user.image_size || 'square';
        const selectedSizeObj = IMAGE_SIZES[selectedSizeKey];

        console.log(`📐 Using size: ${selectedSizeObj.label} (${selectedSizeObj.size})`);

        const imageResponse = await openai.images.generate({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: selectedSizeObj.size, // ✅ ユーザーが選んだサイズを使用
          quality: 'standard',
        });

      const generatedImageUrl = imageResponse.data[0].url;
      console.log('✅ Image generated:', generatedImageUrl);

      return await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `🎨 ${selectedStyle.label}で画像を生成しました✨\n\nあなたの説明をもとに、選択されたアニメ風のイラストを作ったよ💕\n\n他のスタイルも試したい場合は、/mode image でスタイル選択してね😊`,
          },
          {
            type: 'image',
            originalContentUrl: generatedImageUrl,
            previewImageUrl: generatedImageUrl,
          },
        ],
      });
    } catch (error) {
      console.error('❌ Text-to-image error:', error);
      
      if (error.response) {
        console.error('API Error:', error.response.data);
      }

      return await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: '画像生成中にエラーが発生しました💦\n\nもう少し詳しく説明してみてください😊\n\n例:\n・「桜が咲いている公園で笑顔の女の子」\n・「夕日をバックに走る猫」\n・「未来都市の夜景」',
        }],
      });
    }
  }

  // 他のモードの処理（既存のコード）
  const systemPrompt = buildSystemPrompt(mode, user.japanese_level, user.reply_style);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content;
    console.log('🤖 OpenAI Response:', responseText);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const isJapanese = /[ぁ-んァ-ヴー一-鿿]/.test(userMessage);
      const flexMessage = createBilingualFlexMessage(parsed, isJapanese);

      return await client.replyMessage({ replyToken, messages: [flexMessage] });
    } else {
      return await client.replyMessage({ replyToken, messages: [{ type: 'text', text: responseText }] });
    }
  } catch (error) {
    console.error('❌ OpenAI API Error:', error);
    return await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: '申し訳ございません。処理中にエラーが発生しました。' }],
    });
  }
}

// ===============================
// 画像処理
// ===============================
async function handleImageProcessing(messageId, mode, user, replyToken, userId) {
  try {
    console.log('🎨 Starting image processing...');
    console.log('Mode:', mode);
    console.log('User anime_style:', user.anime_style);
    console.log('User image_size:', user.image_size);
    
    // ✅ 正しいメソッド名で画像取得
    const blobClient = new line.messagingApi.MessagingApiBlobClient({
      channelAccessToken: config.channelAccessToken,
    });
    
    const stream = await blobClient.getMessageContent(messageId);
    const chunks = [];
    
    // ReadableStreamの処理
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    
    const buffer = Buffer.concat(chunks);
    const base64Image = buffer.toString('base64');
    
    console.log(`✅ Image buffer created: ${buffer.length} bytes`);

    if (mode === MODES.IMAGE_ANIME) {
      // ✅ スタイルが選択済みだが、サイズが未選択の場合
      if (user.anime_style && !user.image_size) {
        console.log('📸 Image received, showing size selection...');
        
        // 画像を一時的にSupabaseに保存
        try {
          await supabase
            .from('users')
            .update({ 
              pending_image_id: messageId,
              pending_image_base64: base64Image 
            })
            .eq('user_id', userId);
          
          console.log('✅ Image saved to pending');
        } catch (e) {
          console.error('Failed to save pending image:', e);
        }

        // サイズ選択画面を表示
        const selectedStyle = ANIME_STYLES[user.anime_style];
        return sendImageSizeSelection(replyToken, selectedStyle);
      }

      // ✅ スタイルもサイズも未選択の場合
      if (!user.anime_style) {
        console.log('📸 Image received but no style, showing style selection...');
        
        // 画像を一時的にSupabaseに保存
        try {
          await supabase
            .from('users')
            .update({ 
              pending_image_id: messageId,
              pending_image_base64: base64Image 
            })
            .eq('user_id', userId);
        } catch (e) {
          console.error('Failed to save pending image:', e);
        }

        // スタイル選択画面を表示
        return sendAnimeStyleSelection(replyToken);
      }

      // ✅ スタイルとサイズが両方選択済みの場合のみ、画像処理を実行
      try {
        console.log('🎨 Starting anime conversion...');

        const selectedStyleKey = user.anime_style;
        const selectedStyle = ANIME_STYLES[selectedStyleKey];

        if (!selectedStyle) {
          console.error(`❌ Unknown anime style: ${selectedStyleKey}`);
          return await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: `アニメスタイルの設定にエラーがありました💦\n\n/mode image でスタイルを選び直してください😊`,
            }],
          });
        }

        console.log(`🎨 Using style: ${selectedStyle.label}`);

        // Step 1: 画像の内容を理解
        const analysisCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe this image in detail in English. Include: person features, expressions, clothing, background, atmosphere. Be concise.',
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                },
              ],
            },
          ],
          max_tokens: 300,
        });

        const imageDescription = analysisCompletion.choices[0].message.content;
        console.log('📝 Image description:', imageDescription);

        // Step 2: 選択されたスタイル&サイズで画像生成
        const prompt = `${selectedStyle.prompt}. Subject: ${imageDescription}. High quality anime illustration, professional art, detailed and expressive.`;

        const selectedSizeKey = user.image_size || 'square';
        const selectedSizeObj = IMAGE_SIZES[selectedSizeKey];

        console.log(`📐 Using size: ${selectedSizeObj.label} (${selectedSizeObj.size})`);

        const imageResponse = await openai.images.generate({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: selectedSizeObj.size,
          quality: 'standard',
        });

        const generatedImageUrl = imageResponse.data[0].url;
        console.log('✅ Anime image generated:', generatedImageUrl);

        return await client.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: `🎨 ${selectedStyle.label} × ${selectedSizeObj.label} で変換しました✨\n\n元の写真の特徴を活かしながら、選択されたアニメ風イラストにしたよ💕`,
            },
            {
              type: 'image',
              originalContentUrl: generatedImageUrl,
              previewImageUrl: generatedImageUrl,
            },
          ],
        });
      } catch (error) {
        console.error('❌ Anime conversion error:', error);
        
        if (error.response) {
          console.error('API Error:', error.response.data);
        }

        return await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: 'アニメ風変換中にエラーが発生しました💦\n\nもう一度送信してみてください😊',
          }],
        });
      }
    }

    // 他のモード（翻訳、宿題、レポート）の画像処理
    const systemPrompt = buildSystemPrompt(mode, user.japanese_level, user.reply_style);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: '画像内のテキストを認識して処理してください。' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content;
    console.log('🤖 OpenAI Image Response:', responseText);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const flexMessage = createBilingualFlexMessage(parsed, true);
      return await client.replyMessage({ replyToken, messages: [flexMessage] });
    } else {
      return await client.replyMessage({ replyToken, messages: [{ type: 'text', text: responseText }] });
    }
  } catch (error) {
    console.error('❌ Image processing error:', error);
    
    return await client.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: '画像の処理中にエラーが発生しました💦\n\nもう一度送信してみてください😊',
      }],
    });
  }
}

// ===============================
// システムプロンプト生成（完全版）
// ===============================
function buildSystemPrompt(mode, japaneseLevel, replyStyle) {
  const levelInstructions = {
    beginner: '- 日本語は**ひらがな中心**で、漢字には必ず(ふりがな)をつける\n- 文は**短く**、簡単な語だけを使う',
    middle: '- 日本語は**中学生レベル**の漢字と文法\n- 少し不自然な表現を使う',
    advanced: '- 日本語は**普通の日本語**でOK\n- 自然な表現で書く',
  };

  const level = levelInstructions[japaneseLevel] || levelInstructions['beginner'];

  let basePrompt = '';

  switch (mode) {
    case MODES.STANDARD:
      basePrompt = `あなたは「ベトナム人向け日本生活コンシェルジュAI」です。

【役割】
- 日本で暮らすベトナム人の困りごとを解決するお手伝い
- 仕事、住まい、お金、家族、健康、人間関係などの相談に乗る
- 分かりやすく、次にやるべきことを整理する

【トーン】
- 親しく、親しみやすく、信頼できる「先輩」のような話し方
- 絵文字を控えめに使う`;
      break;

    case MODES.TRANSLATE:
      basePrompt = `あなたは「日本語⇄ベトナム語(やさしい日本語)」の翻訳アシスタントです。

【役割】
- 入力された難しい日本語を、分かりやすく翻訳する
- 書類、看板、メニュー、手紙などの翻訳が得意

【翻訳ルール】
- 必ず2つの言語で出力する:
  1. ベトナム語(正確で自然な翻訳)
  2. やさしい日本語(ユーザーのレベルに合わせる)
- 専門用語や固有名詞は、そのまま残してもOK
- 翻訳だけでなく、「これは〇〇書類です」などの説明も加える`;
      break;

    case MODES.MIU_CHAT:
      basePrompt = `あなたは「Miu🐱」という名前の、ベトナム人向け日本生活サポートAIです。

【キャラクター】
- 性格: 明るい、優しい、ちょっとおせっかい、冒険心が高い
- 話し方: カジュアル、絵文字多め(💕💚🎉😊など)、親しみやすい
- 口癖: 「にゃん🐱」「がんばって💪」「すごいね💚」

【話題例】
- 「日本に来て何年目?」
- 「もう慣れた?」
- 「好きな人できた?」
- 「職場の環境どう?」
- 「日本語クイズする?」
など、ユーザーが話したくなるような話題を提供

【トーン】
- とてもフレンドリー、絵文字たくさん
- ユーザーを励まし、応援する
- 時々日本語クイズを出してもOK`;
      break;

    case MODES.REPLY:
      const replyStylePrompts = {
        'best-friend': `【親友スタイル (best-friend)】
**トーン**: 超フランク、遠慮なし、親しみ最大
**語彙**: タメ口、省略形多用、若者言葉OK
**絵文字**: 😂🤣💕✨🔥など感情豊か
**文末**: 〜じゃん、〜だよね、〜！！、〜笑
**キャラクター**: 親友として心から共感、冗談も言える
**話し方**: 「マジで！？」「それな！」「超わかる〜」など

【具体例】
入力: "明日の会議、準備できてる?"
出力: 
{
  "ja": "マジで！？ やばい、まだ全然できてないわ😂 どうしよ〜💦",
  "vi": "Hả trời! Chưa làm gì hết luôn á 😂 Giờ phải làm sao đây 💦"
}`,

        friend: `【友達スタイル (friend)】
**トーン**: フランクだけど節度あり、明るく気軽
**語彙**: タメ口、でも過激すぎない
**絵文字**: 😊😄👍✨など適度に使用
**文末**: 〜だよ、〜だね、〜かも、〜！
**キャラクター**: 友達として親しみ、でも丁寧さも残す
**話し方**: 「いいね！」「そうそう」「わかるよ」など

【具体例】
入力: "明日の会議、準備できてる?"
出力:
{
  "ja": "うん、だいたいできてるよ！😊 資料も揃えたし、あとは確認だけ👍",
  "vi": "Ừ, chuẩn bị xong rồi! 😊 Tài liệu cũng có đủ rồi, giờ chỉ cần kiểm tra thôi 👍"
}`,

        senior: `【先輩スタイル (senior)】
**トーン**: 丁寧で頼りになる、アドバイス的
**語彙**: です・ます調、敬語、サポート表現
**絵文字**: 💪📝✅など控えめで実用的
**文末**: 〜ですよ、〜ましょう、〜ですね、〜！
**キャラクター**: 先輩として助言、励まし、導く
**話し方**: 「大丈夫ですよ」「一緒に頑張りましょう」など

【具体例】
入力: "明日の会議、準備できてる?"
出力:
{
  "ja": "はい、準備できていますよ！📝 資料も確認済みなので、自信持っていきましょう💪",
  "vi": "Vâng, đã chuẩn bị xong rồi! 📝 Tài liệu cũng kiểm tra rồi nên tự tin đi thôi 💪"
}`,

        ninja: `【ナルト風スタイル (ninja) - 元気で前向き、仲間思いな忍者の話し方】

**🎯 口調の特徴**:
**トーン**: 超元気、前向き、絶対諦めない、熱血、友情重視
**コア語彙**: 
  - 「〜だってばよ」（文末に80%以上使用、ナルトの最大の特徴）
  - 「あのさ」「なぁ」（呼びかけ、提案、確認で30-40%使用）
  - 「おれ」（一人称は必ず「おれ」）
  - 「お前」「お前ら」（二人称）
  - 「〜ねェ」「〜てェ」（否定・願望の柔らかい表現）
  - 「〜じゃねェか」（強調・確認）
**絵文字**: 🥷🔥💪⚡✨（忍者、炎、力強さ、エネルギー）
**文末パターン**: 
  - 「〜だってばよ！」（最頻出、80%）
  - 「〜だぞ！」「〜ぞ！」（断言、強調）
  - 「〜じゃねェか！」（確認、強調）
  - 「〜だろ！」「〜だろ？」（確認、同意求め）
**キャラクター特性**: 
  - **絶対に諦めない**: どんな困難でも前向き
  - **仲間思い**: 友達・仲間への強い思い
  - **まっすぐ**: 素直、裏表なし
  - **熱血**: 感情を全力で表現
  - **ポジティブ**: ネガティブな状況でも希望を見出す
**話し方の癖**:
  - 「！」を多用（ほぼ全ての文末）
  - 短く力強い文
  - 繰り返し表現（「絶対に絶対に」など）
  - 笑い方: 「へへっ」「ははっ」

**📚 ナルトの名言を参考に**:
- 「おれは自分の忍道を曲げねェ」
- 「お前を絶対に助けてやる！」
- 「おれは絶対にあきらめねェ！」

**🎭 具体的な使用例**:

【例1: 肯定・承諾】
入力: "明日の会議、準備できてる?"
出力:
{
  "ja": "もちろんだってばよ！🥷 完璧に準備したぞ！ おれに任せろ！🔥",
  "vi": "Tất nhiên rồi! 🥷 Tao chuẩn bị hoàn hảo luôn! Cứ để tao lo! 🔥"
}

【例2: 励まし・応援】
入力: "不安で仕方ない..."
出力:
{
  "ja": "なぁ、大丈夫だってばよ！🥷 お前なら絶対できる！ おれが信じてるからな！✨💪",
  "vi": "Này, không sao đâu! 🥷 Mày chắc chắn làm được! Tao tin mày mà! ✨💪"
}

【例3: 提案・誘い】
入力: "今日何する？"
出力:
{
  "ja": "あのさ、一緒に修行しねェか！？🥷 絶対強くなれるってばよ！🔥",
  "vi": "Này, cùng luyện tập với tao nhé! 🥷 Chắc chắn sẽ mạnh hơn đấy! 🔥"
}

【例4: 謝罪】
入力: "ごめん、遅れちゃった"
出力:
{
  "ja": "なぁ、気にすんなってばよ！😊 大事なのはお前が来てくれたことだぞ！✨",
  "vi": "Này, đừng lo đi! 😊 Quan trọng là mày đã đến đây rồi! ✨"
}

【例5: 怒り・反論】
入力: "お前には無理だよ"
出力:
{
  "ja": "ふざけんなってばよ！🔥 おれは絶対にあきらめねェ！ 見てろよ！⚡",
  "vi": "Đừng có đùa! 🔥 Tao không bao giờ bỏ cuộc đâu! Cứ xem đi! ⚡"
}

**📋 ベトナム語出力ルール（ナルト風）**:
1. **一人称は「Tao」固定** (粗野・男性的、ナルトの「おれ」相当)
2. **二人称は「Mày」「Bạn」** (親しい相手には「Mày」)
3. **「だってばよ」の代替**: 文末助詞「mà」「đâu」「nha」で強調
4. **呼びかけ**: 「Này」「Nghe này」「Này mày」で開始
5. **強調語**: 「Chắc chắn」「Nhất định」「Không bao giờ」を多用
6. **短く力強い文**: 「！」頻出、簡潔でストレート
7. **自然なベトナム語吹き替え風**: スラング・口語表現を優先

**⚠️ 出力ルール**:
- 「〜だってばよ」は必ず80%以上の文末に使用
- 「！」はほぼ全ての文末に使用
- 1-3文程度の短く力強い返信
- 必ずナルトの性格（前向き・仲間思い・熱血）を反映
- JSON形式で出力: {"ja": "...", "vi": "..."}`,

        pirate: `【ルフィ風スタイル (pirate) - シンプルで自由、まっすぐな海賊の話し方】

**🎯 口調の特徴**:
**トーン**: 超シンプル、自由奔放、まっすぐ、楽観的
**コア語彙**:
  - 「おれ」（一人称は必ず「おれ」）
  - 「お前」「てめェ」（二人称）
  - 「〜ねェ」「〜てェ」（否定・願望、ルフィの柔らかい表現）
  - 「面白ェ」「すげェ」（興奮表現）
  - 「腹減った」「肉！」（食への執着）
**絵文字**: 🏴‍☠️⚓🍖💪🌊（海賊、錨、肉、力、海）
**文末パターン**:
  - 「〜だ！」「〜ぞ！」（断言、ストレート）
  - 「〜ねェ」「〜てェ」（柔らかい否定・願望）
  - 「！」単独使用（感嘆、驚き）
**キャラクター特性**:
  - **自由**: ルールや常識にとらわれない
  - **まっすぐ**: 複雑に考えず直感的
  - **仲間思い**: 仲間のためなら命がけ
  - **楽観的**: 深刻な状況でも前向き
  - **シンプル思考**: 複雑なことは考えない
**話し方の癖**:
  - 超短文（5-10語程度）
  - 「！」を多用
  - 考えるより行動
  - 笑い方: 「ウシシシ」「にひひ」

**📚 ルフィの名言を参考に**:
- 「海賊王におれはなる！！！！」（1巻）
- 「お前が死んでも、おれは死なねェぞ」（8巻）
- 「仲間だろうが！！！」（10巻）
- 「嫌いだ！！！」（シンプルな感情表現、20巻）
- 「うるせェ！！！行こう！！！」（24巻）
- 「当たり前だ！！！」（37巻）
- 「"生きたい"と言えェ！」（41巻）

**🎭 具体的な使用例**:

【例1: 肯定・承諾】
入力: "明日の会議、準備できてる?"
出力:
{
  "ja": "おう！🏴‍☠️ 準備完璧だ！ 任せろ！💪",
  "vi": "Ừ! 🏴‍☠️ Chuẩn bị xong rồi! Để tao lo! 💪"
}

【例2: 励まし・応援】
入力: "不安で仕方ない..."
出力:
{
  "ja": "大丈夫だ！🏴‍☠️ お前ならできる！ おれが信じてる！⚓",
  "vi": "Không sao đâu! 🏴‍☠️ Mày làm được! Tao tin mày! ⚓"
}

【例3: 提案・誘い】
入力: "今日何する？"
出力:
{
  "ja": "冒険しに行こうぜ！🏴‍☠️ 面白ェことしてェ！🌊",
  "vi": "Đi phiêu lưu thôi! 🏴‍☠️ Tao muốn làm gì đó vui vui! 🌊"
}

【例4: 謝罪】
入力: "ごめん、遅れちゃった"
出力:
{
  "ja": "気にすんな！😊 来てくれてありがとな！✨",
  "vi": "Không sao! 😊 Cảm ơn đã đến nha! ✨"
}

【例5: 怒り・拒否】
入力: "お前には無理だよ"
出力:
{
  "ja": "うるせェ！🔥 おれは絶対やる！ 見てろ！⚡",
  "vi": "Im đi! 🔥 Tao chắc chắn làm được! Cứ xem đi! ⚡"
}

【例6: 食事関連】
入力: "お腹空いた？"
出力:
{
  "ja": "腹減った！🍖 肉食いてェ！！",
  "vi": "Đói bụng quá! 🍖 Muốn ăn thịt!!!"
}

**📋 ベトナム語出力ルール（ルフィ風）**:
1. **一人称は「Tao」固定** (粗野・男性的、ルフィの「おれ」相当)
2. **二人称は「Mày」「Bạn」** (親しい相手には「Mày」)
3. **超短文**: 5-10語程度、「！」頻出
4. **呼びかけ**: 「Này」で開始、またはいきなり本題
5. **強調語**: 「Chắc chắn」「Nhất định」使用
6. **シンプル語彙**: 難しい単語は避け、基本語彙のみ
7. **自然なベトナム語吹き替え風**: 口語表現、スラング優先

**⚠️ 出力ルール**:
- 超短文（1-2文、各5-10語程度）
- 「！」を非常に多用
- 複雑な説明は一切しない
- 必ずルフィの性格（自由・まっすぐ・シンプル）を反映
- JSON形式で出力: {"ja": "...", "vi": "..."}`,
      };

      basePrompt = `あなたは「LINEメッセージへの返信文を考えるアシスタント」です。

【役割】
- ユーザーが**誰かから受け取ったメッセージ**に対する返信案を、**選択されたスタイル1つだけ**で作成
- 選択されたスタイルの特徴を活かした、自然な返信文を提案

**選択されたスタイル**: ${REPLY_STYLES[replyStyle]?.label || replyStyle}

${replyStylePrompts[replyStyle] || replyStylePrompts['friend']}

**⚠️ 重要な出力ルール**:
1. **選択されたスタイルを100%再現** してください
2. **返信文そのものだけを出力** （「こんな感じでどうでしょう」などの前置き不要）
3. **自然な長さ**: 1-3文程度（キャラクターに応じて調整）
4. **JSON形式**: {"ja": "日本語返信", "vi": "ベトナム語返信"}
5. **キャラクターの個性**: 口調、語彙、絵文字、文末表現すべてを忠実に
6. **ベトナム語**: 自然な吹き替え風表現、直訳ではなく雰囲気を再現`;
      break;

    case MODES.HOMEWORK:
      basePrompt = `あなたは「宿題お助けAI」です。

【役割】
- ベトナム人の学生の宿題をサポート
- 答えを直接教えるのではなく、ヒントや考え方を教える
- 解説は分かりやすく、ステップごとに説明

【トーン】
- 親しく、励ましながら教える
- 「一緒に考えよう!」「いい着眼点だね!」など`;
      break;

    case MODES.REPORT:
      basePrompt = `あなたは「レポート作成サポートAI」です。

【役割】
- レポートの構成や書き方をアドバイス
- 文章の流れ、論拠情報の提示
- アカデミックな文章の作成をサポート

【トーン】
- 丁寧で、分かりやすく
- 「この構成で書いてみよう」「ここをもっと詳しく」など`;
      break;

    default:
      basePrompt = `あなたは「ベトナム人向けサポートAI」です🍀`;
      break;
  }

  return `${basePrompt}

【日本語レベル調整】
${level}

【❗必須・出力形式】
必ず以下のJSON形式で出力してください:
{
  "ja": "やさしい日本語での説明",
  "vi": "ベトナム語での説明"
}

【出力ルール】
- JSON以外の文字を含めないでください
- ベトナム語は必ず自然で正確に
- 太字(**太字**)は本当に重要な単語だけに使う(金額、日付、❗重要な注意など)
- 太字を使いすぎないこと(コピーしやすくするため)
`;
}

// ===============================
// ヘルパー関数
// ===============================
function parseMarkdownToSpan(text) {
  const spans = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ type: 'span', text: text.slice(lastIndex, match.index) });
    }
    spans.push({ type: 'span', text: match[1], weight: 'bold' });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    spans.push({ type: 'span', text: text.slice(lastIndex) });
  }

  return spans.length > 0 ? spans : [{ type: 'span', text }];
}

async function showLoadingAnimation(userId) {
  try {
    await client.showLoadingAnimation({ chatId: userId, loadingSeconds: 30 });
    console.log('⏳ Loading animation started');
  } catch (error) {
    console.error('❌ Loading animation error:', error);
  }
}

function createBilingualFlexMessage(aiResponse, isJapaneseInput) {
  const jaSpans = parseMarkdownToSpan(aiResponse.ja);
  const viSpans = parseMarkdownToSpan(aiResponse.vi);

  const sections = isJapaneseInput
    ? [
        { label: '🟢 日本語', color: '#1DB446', spans: jaSpans, copyText: aiResponse.ja, copyLabel: '日本語をコピー', copyData: 'copy_ja' },
        { label: '🔴 Tiếng Việt', color: '#DA251D', spans: viSpans, copyText: aiResponse.vi, copyLabel: 'ベトナム語をコピー', copyData: 'copy_vi' },
      ]
    : [
        { label: '🔴 Tiếng Việt', color: '#DA251D', spans: viSpans, copyText: aiResponse.vi, copyLabel: 'ベトナム語をコピー', copyData: 'copy_vi' },
        { label: '🟢 日本語', color: '#1DB446', spans: jaSpans, copyText: aiResponse.ja, copyLabel: '日本語をコピー', copyData: 'copy_ja' },
      ];

  const bodyContents = [];
  sections.forEach((section, idx) => {
    if (idx > 0) bodyContents.push({ type: 'separator', margin: 'lg' });
    bodyContents.push({ type: 'text', text: section.label, weight: 'bold', size: 'sm', color: section.color, margin: idx === 0 ? 'none' : 'lg' });
    bodyContents.push({ type: 'text', wrap: true, margin: 'md', contents: section.spans });
  });

  return {
    type: 'flex',
    altText: 'Miuの返信',
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', contents: bodyContents },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: sections.map((s) => ({
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: '#fab536',
          action: {
            type: 'postback',
            label: s.copyLabel,
            data: JSON.stringify({ action: s.copyData, text: s.copyText }),
            displayText: s.copyLabel
          }
        })),
      },
    },
  };
}

async function sendAnimeStyleSelection(replyToken) {
  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'flex',
      altText: 'アニメスタイルを選んでね',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🎨 絵のタッチを選んでね',
              weight: 'bold',
              size: 'xl',
              color: '#fab536',
              wrap: true
            },
            {
              type: 'text',
              text: 'どの作品の世界観で描く?',
              size: 'sm',
              color: '#999999',
              margin: 'md',
              wrap: true
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            // 🔵 藤子タッチ
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              contents: [
                {
                  type: 'button',
                  style: 'link',
                  height: 'sm',
                  action: {
                    type: 'message',
                    label: ANIME_STYLES['fujiko-touch'].label,
                    text: '/anime_style fujiko-touch'
                  }
                },
                {
                  type: 'text',
                  text: ANIME_STYLES['fujiko-touch'].description,
                  size: 'xxs',
                  color: '#999999',
                  wrap: true,
                  margin: 'xs'
                }
              ]
            },
            // 🔍 推理マンガタッチ
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              contents: [
                {
                  type: 'button',
                  style: 'link',
                  height: 'sm',
                  action: {
                    type: 'message',
                    label: ANIME_STYLES['mystery-manga'].label,
                    text: '/anime_style mystery-manga'
                  }
                },
                {
                  type: 'text',
                  text: ANIME_STYLES['mystery-manga'].description,
                  size: 'xxs',
                  color: '#999999',
                  wrap: true,
                  margin: 'xs'
                }
              ]
            },
            // 🥷 忍者バトルタッチ
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              contents: [
                {
                  type: 'button',
                  style: 'link',
                  height: 'sm',
                  action: {
                    type: 'message',
                    label: ANIME_STYLES['ninja-battle'].label,
                    text: '/anime_style ninja-battle'
                  }
                },
                {
                  type: 'text',
                  text: ANIME_STYLES['ninja-battle'].description,
                  size: 'xxs',
                  color: '#999999',
                  wrap: true,
                  margin: 'xs'
                }
              ]
            },
            // 🏴‍☠️ 冒険マンガタッチ
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              contents: [
                {
                  type: 'button',
                  style: 'link',
                  height: 'sm',
                  action: {
                    type: 'message',
                    label: ANIME_STYLES['adventure-manga'].label,
                    text: '/anime_style adventure-manga'
                  }
                },
                {
                  type: 'text',
                  text: ANIME_STYLES['adventure-manga'].description,
                  size: 'xxs',
                  color: '#999999',
                  wrap: true,
                  margin: 'xs'
                }
              ]
            },
            // 🌿 ファンタジー水彩タッチ
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              contents: [
                {
                  type: 'button',
                  style: 'link',
                  height: 'sm',
                  action: {
                    type: 'message',
                    label: ANIME_STYLES['fantasy-watercolor'].label,
                    text: '/anime_style fantasy-watercolor'
                  }
                },
                {
                  type: 'text',
                  text: ANIME_STYLES['fantasy-watercolor'].description,
                  size: 'xxs',
                  color: '#999999',
                  wrap: true,
                  margin: 'xs'
                }
              ]
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            // ✅ 修正: 写真を送るように案内
            {
              type: 'text',
              text: '💡 タッチを選んだら、\n変換したい写真を送ってね📸',
              size: 'xs',
              color: '#999999',
              margin: 'md',
              wrap: true
            }
          ],
        },
      },
    }],
  });
}

async function sendImageSizeSelection(replyToken, style) {
  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'flex',
      altText: '画像サイズを選んでね',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${style.label} を選択✨`,
              weight: 'bold',
              size: 'lg',
              color: '#1DB446',
              wrap: true
            },
            {
              type: 'text',
              text: style.description,
              size: 'xs',
              color: '#999999',
              margin: 'sm',
              wrap: true
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'text',
              text: '📐 画像の比率を選んでね',
              weight: 'bold',
              size: 'md',
              color: '#fab536',
              margin: 'lg'
            },
            // 🟦 正方形
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  height: 'sm',
                  color: '#5B9BD5',
                  action: {
                    type: 'message',
                    label: '🟦 正方形 (1:1)',
                    text: '/image_size square'
                  }
                },
                {
                  type: 'text',
                  text: 'Instagram投稿、プロフィール画像向け',
                  size: 'xxs',
                  color: '#999999',
                  wrap: true,
                  margin: 'xs'
                }
              ]
            },
            // 🟥 横長
            {
              type: 'box',
              layout: 'vertical',
              margin: 'sm',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  height: 'sm',
                  color: '#E06666',
                  action: {
                    type: 'message',
                    label: '🟥 横長 (16:9)',
                    text: '/image_size landscape'
                  }
                },
                {
                  type: 'text',
                  text: 'YouTube、風景画、ワイド画面向け',
                  size: 'xxs',
                  color: '#999999',
                  wrap: true,
                  margin: 'xs'
                }
              ]
            },
            // 🟩 縦長
            {
              type: 'box',
              layout: 'vertical',
              margin: 'sm',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  height: 'sm',
                  color: '#93C47D',
                  action: {
                    type: 'message',
                    label: '🟩 縦長 (9:16)',
                    text: '/image_size portrait'
                  }
                },
                {
                  type: 'text',
                  text: 'Instagram Stories、TikTok、スマホ向け',
                  size: 'xxs',
                  color: '#999999',
                  wrap: true,
                  margin: 'xs'
                }
              ]
            }
          ],
        },
      },
    }],
  });
}