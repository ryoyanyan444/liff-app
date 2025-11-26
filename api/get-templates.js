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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // テンプレート一覧取得
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // テンプレートが存在しない場合はデフォルトを返す
    if (!templates || templates.length === 0) {
      return res.status(200).json([
        {
          id: 1,
          title: 'Dịch tiếng Việt',
          description: 'Dịch văn bản sang tiếng Việt',
          prompt: 'Hãy dịch văn bản sau sang tiếng Việt:'
        },
        {
          id: 2,
          title: 'Dịch tiếng Anh',
          description: 'Dịch văn bản sang tiếng Anh',
          prompt: 'Hãy dịch văn bản sau sang tiếng Anh:'
        },
        {
          id: 3,
          title: 'Giải thích đơn giản',
          description: 'Giải thích nội dung một cách dễ hiểu',
          prompt: 'Hãy giải thích nội dung sau một cách đơn giản và dễ hiểu:'
        },
        {
          id: 4,
          title: 'Tóm tắt nội dung',
          description: 'Tóm tắt văn bản ngắn gọn',
          prompt: 'Hãy tóm tắt nội dung sau một cách ngắn gọn:'
        }
      ]);
    }

    return res.status(200).json(templates);

  } catch (error) {
    console.error('Get templates error:', error);
    return res.status(500).json({ error: error.message });
  }
};