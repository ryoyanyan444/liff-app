const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Vercel serverless functionではbodyを生で取得する必要がある
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Vercelでは req.body が既にバッファとして渡される
    const body = await getRawBody(req);
    
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    // イベント処理
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
};

// Raw bodyを取得するヘルパー関数
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Checkout完了時の処理
async function handleCheckoutSessionCompleted(session) {
  const lineUserId = session.metadata.line_user_id;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  if (!lineUserId) {
    console.error('No line_user_id in session metadata');
    return;
  }

  // ユーザー情報更新
  const { error } = await supabase
    .from('users')
    .update({
      plan: 'premium',
      stripe_customer_id: customerId,
      subscription_id: subscriptionId,
      today_count: 0,
      vision_count: 0
    })
    .eq('user_id', lineUserId);

  if (error) {
    console.error('Error updating user to premium:', error);
  } else {
    console.log(`User ${lineUserId} upgraded to premium`);
  }
}

// サブスクリプション更新時の処理
async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  // Stripe Customer IDからLINE User IDを取得
  const { data: user, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // ステータスに応じてプラン更新
  let newPlan = 'free';
  if (status === 'active' || status === 'trialing') {
    newPlan = 'premium';
  }

  await supabase
    .from('users')
    .update({
      plan: newPlan,
      subscription_id: subscriptionId
    })
    .eq('user_id', user.user_id);

  console.log(`User ${user.user_id} subscription updated to ${status}`);
}

// サブスクリプション削除時の処理
async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  // Stripe Customer IDからLINE User IDを取得
  const { data: user, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // プランをfreeに戻す
  await supabase
    .from('users')
    .update({
      plan: 'free',
      subscription_id: null
    })
    .eq('user_id', user.user_id);

  console.log(`User ${user.user_id} subscription deleted, downgraded to free`);
}

// 支払い失敗時の処理
async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  console.log(`Payment failed for customer ${customerId}, subscription ${subscriptionId}`);

  // 必要に応じてユーザーに通知する処理を追加
}