const express = require('express');

const app = express();
const port = process.env.PORT || 5002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/notify', (req, res) => {
  const { team, ticketId, title } = req.body || {};
  if (!team || !ticketId) {
    return res.status(400).json({ error: 'team and ticketId are required' });
  }

  // Stub: swap for a real Slack/email integration later.
  console.log(`[notify] ticket #${ticketId} "${title}" routed to ${team}`);

  res.status(202).json({ accepted: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`notification-service listening on port ${port}`);
});
