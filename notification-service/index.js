const express = require('express');

const app = express();
const port = process.env.PORT || 5002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// In-memory log of dummy emails "sent", so the frontend can display them.
const notifications = [];
let nextNotificationId = 1;

// Dummy email sender: logs what would be sent instead of calling a real
// provider (SES, SendGrid, etc.). Swap sendEmail's body for a real
// integration later — the call sites below wouldn't need to change.
function sendEmail({ to, subject, body }) {
  notifications.push({
    id: nextNotificationId++,
    to,
    subject,
    body,
    sentAt: new Date().toISOString(),
  });
  console.log(`[email] to=${to} subject="${subject}" body="${body}"`);
}

app.get('/api/notifications', (req, res) => {
  res.json(notifications.slice().reverse());
});

app.post('/api/notify', (req, res) => {
  const { type, ticketId, title, team, assigneeName, assigneeEmail } = req.body || {};
  if (!type || !ticketId) {
    return res.status(400).json({ error: 'type and ticketId are required' });
  }

  if (type === 'ticket_created') {
    if (!team) {
      return res.status(400).json({ error: 'team is required for ticket_created' });
    }
    sendEmail({
      to: `${team}@routedesk.example.com`,
      subject: `New ticket #${ticketId}: ${title}`,
      body: `A new ticket has been routed to your team (${team}).`,
    });
  } else if (type === 'ticket_assigned') {
    if (!assigneeEmail) {
      return res.status(400).json({ error: 'assigneeEmail is required for ticket_assigned' });
    }
    sendEmail({
      to: assigneeEmail,
      subject: `Ticket #${ticketId} assigned to you`,
      body: `Hi ${assigneeName || ''}, you've been assigned ticket "${title}".`,
    });
  } else {
    return res.status(400).json({ error: `unknown notification type: ${type}` });
  }

  res.status(202).json({ accepted: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`notification-service listening on port ${port}`);
});
