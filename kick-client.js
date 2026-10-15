
'use strict';

(() => {
  const status = document.getElementById('kickStatus');
  const connectBtn = document.getElementById('kickConnect');
  const disconnectBtn = document.getElementById('kickDisconnect');
  const channelInput = document.getElementById('kickChannel');

  if (!status || !connectBtn || !disconnectBtn || !channelInput) return;

  const key = () => sessionStorage.getItem('shabba_admin_key') || '';

  const events = new EventSource('/api/kick/events');

  events.onmessage = event => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        status.textContent = data.status;
      }

      if (data.type === 'chat' && typeof receive === 'function') {
        receive(data.name, data.msg, 'kick');
      }
    } catch (err) {
      console.warn('[Kick]', err);
    }
  };

  events.onerror = () => {
    status.textContent = 'انقطع الاتصال بتحديثات Kick من الخادم';
  };

  async function call(action, body = {}) {
    const response = await fetch('/api/kick/' + action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': key()
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({
      error: 'تعذر قراءة رد الخادم'
    }));

    if (!response.ok) {
      throw Error(data.error || 'فشل الاتصال بـ Kick');
    }

    return data;
  }

  connectBtn.onclick = async () => {
    const username = channelInput.value.trim().replace(/^@/, '');

    if (!username) {
      status.textContent = 'أدخل اسم قناة Kick أولًا';
      return;
    }

    status.textContent = 'جارٍ الاتصال بشات Kick...';
    connectBtn.disabled = true;

    try {
      await call('connect', { username });
    } catch (err) {
      status.textContent = err.message;
    } finally {
      connectBtn.disabled = false;
    }
  };

  disconnectBtn.onclick = async () => {
    try {
      await call('disconnect');
    } catch (err) {
      status.textContent = err.message;
    }
  };
})();
