
'use strict';

const { KickConnection, Events } = require('kick-live-connector');

let connection = null;
let channel = '';
let status = 'غير متصل';
const listeners = new Set();

function broadcast(data) {
  const message = 'data: ' + JSON.stringify(data) + '\n\n';

  for (const res of listeners) {
    try {
      res.write(message);
    } catch {
      listeners.delete(res);
    }
  }
}

function setStatus(value) {
  status = value;
  console.log('[Kick] STATUS:', value);
  broadcast({ type: 'status', status, channel });
}

function events(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  listeners.add(res);

  res.write(
    'data: ' +
    JSON.stringify({ type: 'status', status, channel }) +
    '\n\n'
  );

  req.on('close', () => listeners.delete(res));
}

async function stop() {
  const old = connection;

  connection = null;
  channel = '';

  if (old) {
    try {
      old.disconnect();
    } catch (err) {
      console.error('[Kick] DISCONNECT ERROR:', err);
    }
  }

  setStatus('غير متصل');
}

async function start(username) {
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(username)) {
    throw new Error('اسم قناة Kick غير صالح');
  }

  await stop();

  channel = username;
  setStatus('جارٍ الاتصال بـ Kick...');

  const conn = new KickConnection(username);
  connection = conn;

  conn.on(Events.ChatMessage, data => {
    if (connection !== conn) return;

    const name = data?.sender?.username;
    const msg = data?.content;

    if (name && typeof msg === 'string' && msg.trim()) {
      console.log('[Kick] CHAT:', name, msg);

      broadcast({
        type: 'chat',
        name,
        msg: msg.trim(),
        platform: 'kick'
      });
    }
  });

  conn.on(Events.Connected, data => {
    if (connection !== conn) return;

    console.log('[Kick] CONNECTED EVENT:', data);
    setStatus('متصل بشات Kick: @' + username);
  });

  conn.on(Events.Disconnected, data => {
    if (connection !== conn) return;

    console.warn('[Kick] DISCONNECTED EVENT:', data);
    setStatus('انقطع اتصال شات Kick');
  });

  conn.on(Events.Error, err => {
    if (connection !== conn) return;

    const message = String(err?.message || err);

    console.error('[Kick] CONNECTION ERROR:', err);
    setStatus('خطأ Kick: ' + message.slice(0, 140));
  });

  try {
    const result = await conn.connect();

    console.log('[Kick] CONNECT RESULT:', result);

    if (!result?.roomID) {
      throw new Error('تعذر فتح غرفة شات Kick');
    }

    if (connection === conn) {
      setStatus('متصل بشات Kick: @' + username);
    }
  } catch (err) {
    console.error('[Kick] START FAILED:', err);

    if (connection === conn) {
      connection = null;

      try {
        conn.disconnect();
      } catch (disconnectError) {
        console.error(
          '[Kick] CLEANUP ERROR:',
          disconnectError
        );
      }

      setStatus(
        'فشل الاتصال: ' +
        String(err?.message || err).slice(0, 140)
      );
    }

    throw err;
  }
}

function handler(req, res, url, send) {
  if (
    url.pathname === '/api/kick/events' &&
    req.method === 'GET'
  ) {
    events(req, res);
    return true;
  }

  if (
    ![
      '/api/kick/connect',
      '/api/kick/disconnect'
    ].includes(url.pathname)
  ) {
    return false;
  }

  if (req.method !== 'POST') {
    send(res, 405, 'Method not allowed');
    return true;
  }

  const expected = process.env.ADMIN_KEY;

  if (
    !expected ||
    req.headers['x-admin-key'] !== expected
  ) {
    send(res, 403, 'Admin key required');
    return true;
  }

  if (url.pathname === '/api/kick/disconnect') {
    stop()
      .then(() => {
        send(
          res,
          200,
          JSON.stringify({ ok: true }),
          'application/json'
        );
      })
      .catch(err => {
        console.error('[Kick] STOP FAILED:', err);

        send(
          res,
          500,
          JSON.stringify({
            ok: false,
            error: String(err?.message || err)
          }),
          'application/json'
        );
      });

    return true;
  }

  let body = '';

  req.on('data', chunk => {
    body += chunk;

    if (body.length > 1000) {
      req.destroy();
    }
  });

  req.on('end', async () => {
    try {
      const username = String(
        JSON.parse(body).username || ''
      ).replace(/^@/, '').trim();

      await start(username);

      send(
        res,
        200,
        JSON.stringify({ ok: true, status }),
        'application/json'
      );
    } catch (err) {
      send(
        res,
        422,
        JSON.stringify({
          ok: false,
          error: String(err?.message || err)
        }),
        'application/json'
      );
    }
  });

  return true;
}

module.exports = { handler };
