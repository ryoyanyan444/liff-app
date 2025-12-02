// api/supa-debug.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL || null;
    const key = process.env.SUPABASE_SERVICE_KEY || null;

    if (!url || !key) {
      return res.status(200).json({
        ok: false,
        stage: 'env',
        url,
        hasKey: !!key,
        message: 'SUPABASE_URL か SUPABASE_SERVICE_KEY が入ってません'
      });
    }

    const supabase = createClient(url, key);

    // 🔹 ?insert=1 が付いてたら、テストユーザーを1件追加してみる
    if (req.query && req.query.insert === '1') {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('users')
        .insert([{
          user_id: 'debug-user',
          display_name: 'Debug User',
          plan: 'free',
          today_count: 0,
          vision_count: 0,
          daily_limit: 10,
          last_reset_date: today
        }])
        .select()
        .single();

      if (error) {
        return res.status(200).json({
          ok: false,
          stage: 'insert',
          message: error.message || String(error)
        });
      }

      return res.status(200).json({
        ok: true,
        stage: 'insert',
        inserted: data
      });
    }

    // 🔹 何も指定しないときは、普通に先頭5件を見る
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(5);

    if (error) {
      return res.status(200).json({
        ok: false,
        stage: 'query',
        message: error.message || String(error),
        data: null
      });
    }

    return res.status(200).json({
      ok: true,
      stage: 'query',
      count: data.length,
      sample: data
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      stage: 'crash',
      message: e.message || String(e)
    });
  }
};
