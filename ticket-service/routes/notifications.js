const express = require('express');

const router = express.Router();

// Same internal-routing hostname ticket-service uses to POST notifications;
// reused here to let the frontend read the sent-email log through the
// existing gateway -> ticket-service hop instead of exposing
// notification-service directly.
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;

router.get('/', async (req, res) => {
  if (!NOTIFICATION_SERVICE_URL) {
    return res.json([]);
  }

  try {
    const upstream = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `notification-service unreachable: ${err.message}` });
  }
});

module.exports = router;
