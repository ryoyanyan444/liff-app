// api/get-templates.js

import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// デフォルトのテンプレ（Supabaseが空 or エラーのときに使う）
const FALLBACK_TEMPLATES = [
  {
    id: 1,
    category: "reply_polite",
    displayLabel: "返信モード：丁寧なお礼",
    message: "お問い合わせありがとうございます。こちらこそよろしくお願いいたします。"
  },
  {
    id: 2,
    category: "reply_casual",
    displayLabel: "返信モード：カジュアルな返事",
    message: "メッセージありがとう！めっちゃ助かりました！"
  }
];

export default async function handler(req, res) {
  // CORS（最低限）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Requested-With'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      debug: 'supabase-with-fallback'
    });
  }

  try {
    // まず Supabase から全件とりあえず取ってみる
    const { data, error } = await supabase
      .from('templates')
      .select('*');

    // エラー or 行が0件 → デフォルトテンプレを返す
    if (error) {
      console.error('Supabase error in get-templates:', error);
      return res.status(200).json({
        success: true,
        debug: 'fallback-used-error',
        source: 'fallback',
        templates: FALLBACK_TEMPLATES
      });
    }

    if (!data || data.length === 0) {
      // テーブル空っぽの場合もデフォルト
      return res.status(200).json({
        success: true,
        debug: 'fallback-used-empty',
        source: 'fallback',
        templates: FALLBACK_TEMPLATES
      });
    }

    // Supabase に行がある場合はこちら
    const templates = data.map((t) => ({
      id: t.id,
      category: t.category ?? null,
      displayLabel: t.display_label ?? null,
      message: t.message ?? null
    }));

    return res.status(200).json({
      success: true,
      debug: 'supabase-data',
      source: 'supabase',
      templates
    });
  } catch (e) {
    console.error('Get templates fatal error:', e);
    // ここでも最悪フォールバック
    return res.status(200).json({
      success: true,
      debug: 'fallback-used-exception',
      source: 'fallback',
      templates: FALLBACK_TEMPLATES
    });
  }
}
