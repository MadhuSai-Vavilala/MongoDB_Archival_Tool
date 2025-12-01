const axios = require('axios');

async function sendTelegram(cfg, text) {
  try {
    if (!cfg.notification || !cfg.notification.telegram || !cfg.notification.telegram.enabled) return;
    const token = cfg.notification.telegram.bot_token;
    const chatId = cfg.notification.telegram.chat_id;
    if (!token || !chatId) return;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text });
  } catch (e) {
    // non-fatal; caller should log if desired
    console.error('telegram send failed', e.message);
  }
}

module.exports = { sendTelegram };

