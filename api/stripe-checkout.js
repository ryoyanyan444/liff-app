// api/stripe-checkout.js
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // ================================
  // CORS 設定
  // ================================
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // ====================================
    // 1. パラメータ取得
    // ====================================
    const { userId, planType, plan } = req.body || {};
    const selectedPlan = planType || plan; // どっちの名前で来てもOKにする

    if (!userId || !selectedPlan) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing userId or planType' });
    }

    // ====================================
    // 2. plan → priceId マッピング
    //    フロントの value: "3month" / "monthly"
    // ====================================
    let priceId = null;
    let planLabel = null;

    if (selectedPlan === '3month') {
      priceId = process.env.PRICE_ID_3MONTHS;
      planLabel = '3month';
    } else if (selectedPlan === 'monthly' || selectedPlan === '1month') {
      priceId = process.env.PRICE_ID_1MONTH;
      planLabel = 'monthly';
    } else {
      return res.status(400).json({
        success: false,
        error: `Unknown plan type: ${selectedPlan}`
      });
    }

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: 'Price ID is not configured on server'
      });
    }

    // ====================================
    // 3. Supabase からユーザー取得 or 作成
    // ====================================
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 = Row not found
      console.error('Supabase user fetch error:', userError);
    }

    if (!user) {
      // まだ users にいない場合はここで作成してしまう
      console.log('User not found. Creating new user for checkout.');

      const today = new Date().toISOString().split('T')[0];

      const { data: newUser, error: insertErr } = await supabase
        .from('users')
        .insert([
          {
            user_id: userId,
            display_name: 'LINE User', // 必要なら LIFF から displayName 渡して上書きも可
            plan: 'free',
            today_count: 0,
            vision_count: 0,
            daily_limit: 10, // デフォルト上限
            last_reset_date: today
          }
        ])
        .select()
        .single();

      if (insertErr || !newUser) {
        console.error('Supabase user insert error:', insertErr);
        return res
          .status(500)
          .json({ success: false, error: 'Failed to create user record' });
      }

      user = newUser;
    }

    let customerId = user.stripe_customer_id;

    // ====================================
    // 4. Stripe Customer 作成（なければ）
    // ====================================
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          line_user_id: userId,
          display_name: user.display_name || 'LINE User'
        }
      });

      customerId = customer.id;

      // Supabase に保存
      const { error: updateErr } = await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);

      if (updateErr) {
        console.error('Supabase update stripe_customer_id error:', updateErr);
        // ここでエラーでも、Checkout 自体は続行できるので止めない
      }
    }

    // ====================================
    // 5. Stripe Checkout Session 作成
    // ====================================
    const liffUrl =
      process.env.LIFF_URL || 'https://liff.line.me/2008551240-vWN36gzR';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${liffUrl}?success=true&plan=${encodeURIComponent(
        planLabel
      )}`,
      cancel_url: `${liffUrl}?canceled=true&plan=${encodeURIComponent(
        planLabel
      )}`,
      metadata: {
        line_user_id: userId,
        plan: planLabel
      }
    });

    // ====================================
    // 6. フロントへ URL を返す
    // ====================================
    return res.status(200).json({
      success: true,
      url: session.url
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Stripe checkout internal error'
    });
  }
};
