const express = require('express');

const router = express.Router();

// category -> team assignment rules. Falls back to general-support.
const CATEGORY_TEAM_MAP = {
  billing: 'finance-ops',
  outage: 'sre-oncall',
  incident: 'sre-oncall',
  bug: 'engineering',
  access: 'it-support',
  permissions: 'it-support',
};

function routeToTeam(category) {
  const key = String(category || '').toLowerCase();
  return CATEGORY_TEAM_MAP[key] || 'general-support';
}

const tickets = [];
let nextId = 1;

// Base URL of the notification-service app, reachable because both apps
// are internal-routing-enabled apps in the same Private Space
// (e.g. https://routedesk-notification-service.herokuapp.com).
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;

async function notifyTeam(ticket) {
  if (!NOTIFICATION_SERVICE_URL) return;

  try {
    await fetch(`${NOTIFICATION_SERVICE_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: ticket.team,
        ticketId: ticket.id,
        title: ticket.title,
      }),
    });
  } catch (err) {
    console.warn(`notification-service call failed: ${err.message}`);
  }
}

router.post('/', (req, res) => {
  const { title, description, category } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const ticket = {
    id: nextId++,
    title,
    description: description || '',
    category: category || null,
    team: routeToTeam(category),
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  tickets.push(ticket);
  notifyTeam(ticket);
  res.status(201).json(ticket);
});

router.get('/', (req, res) => {
  res.json(tickets);
});

router.get('/:id', (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) {
    return res.status(404).json({ error: 'ticket not found' });
  }
  res.json(ticket);
});

module.exports = router;
