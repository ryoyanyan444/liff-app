const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // 認証チェック（オプション）
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('⚠️ Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        temp_image_base64: null,
        temp_image_timestamp: null
      })
      .lt('temp_image_timestamp', oneHourAgo)
      .not('temp_image_base64', 'is', null)
      .select();

    if (error) {
      console.error('❌ Cleanup error:', error);
      return res.status(500).json({ error: 'Cleanup failed', details: error });
    }

    const cleanedCount = data?.length || 0;
    console.log(`✅ Cleaned up ${cleanedCount} expired images`);
    
    return res.status(200).json({ 
      success: true, 
      cleaned: cleanedCount,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('❌ Cleanup exception:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};