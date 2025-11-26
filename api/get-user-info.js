const { createClient } = require('@supabase/supabase-js');

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
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // ユーザー情報取得
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // ユーザーが存在しない場合はデフォルト情報を返す
      if (error.code === 'PGRST116') {
        return res.status(200).json({
          user_id: userId,
          display_name: 'User',
          plan: 'free',
          today_count: 0,
          vision_count: 0,
          last_reset_date: new Date().toISOString().split('T')[0],
          stripe_customer_id: null,
          subscription_id: null
        });
      }
      throw error;
    }

    // プラン別の制限情報を追加
    const limits = {
      free: { daily: 10, vision: 3 },
      trial: { daily: 50, vision: 20 },
      premium: { daily: 999999, vision: 999999 }
    };

    const userPlan = user.plan || 'free';
    const planLimits = limits[userPlan];

    return res.status(200).json({
      ...user,
      limits: planLimits,
      remaining: {
        daily: Math.max(0, planLimits.daily - user.today_count),
        vision: Math.max(0, planLimits.vision - user.vision_count)
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    return res.status(500).json({ error: error.message });
  }
};