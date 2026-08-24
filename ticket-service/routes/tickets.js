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

const STATUSES = ['open', 'in-progress', 'resolved', 'closed'];

// Sample roster per team, used by the frontend to suggest an assignee and
// by notifyAssignee() to address the (dummy) assignment email.
const TEAM_MEMBERS = {
  'finance-ops': [
    { name: 'Priya Shah', email: 'priya.shah@routedesk.example.com' },
    { name: 'Marcus Lee', email: 'marcus.lee@routedesk.example.com' },
  ],
  'sre-oncall': [
    { name: 'Diego Ramirez', email: 'diego.ramirez@routedesk.example.com' },
    { name: 'Sarah Chen', email: 'sarah.chen@routedesk.example.com' },
  ],
  engineering: [
    { name: 'Wei Zhang', email: 'wei.zhang@routedesk.example.com' },
    { name: 'Aisha Khan', email: 'aisha.khan@routedesk.example.com' },
  ],
  'it-support': [
    { name: 'Tom Becker', email: 'tom.becker@routedesk.example.com' },
    { name: 'Nina Petrova', email: 'nina.petrova@routedesk.example.com' },
  ],
  'general-support': [
    { name: 'Alex Johnson', email: 'alex.johnson@routedesk.example.com' },
    { name: 'Jordan Smith', email: 'jordan.smith@routedesk.example.com' },
  ],
};

function findAssigneeEmail(team, name) {
  const member = (TEAM_MEMBERS[team] || []).find((m) => m.name === name);
  return member ? member.email : null;
}

const tickets = [];
let nextId = 1;

// Base URL of the notification-service app, reachable because both apps
// are internal-routing-enabled apps in the same Private Space
// (e.g. https://routedesk-notification-service.herokuapp.com).
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;

async function notify(payload) {
  if (!NOTIFICATION_SERVICE_URL) return;

  try {
    await fetch(`${NOTIFICATION_SERVICE_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn(`notification-service call failed: ${err.message}`);
  }
}

function notifyTeam(ticket) {
  return notify({
    type: 'ticket_created',
    ticketId: ticket.id,
    title: ticket.title,
    team: ticket.team,
  });
}

function notifyAssignee(ticket) {
  const assigneeEmail = findAssigneeEmail(ticket.team, ticket.assignee);
  if (!assigneeEmail) return;

  return notify({
    type: 'ticket_assigned',
    ticketId: ticket.id,
    title: ticket.title,
    assigneeName: ticket.assignee,
    assigneeEmail,
  });
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
    assignee: null,
    archived: false,
    createdAt: new Date().toISOString(),
  };

  tickets.push(ticket);
  notifyTeam(ticket);
  res.status(201).json(ticket);
});

router.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  res.json(includeArchived ? tickets : tickets.filter((t) => !t.archived));
});

router.get('/meta/roster', (req, res) => {
  res.json({ statuses: STATUSES, teamMembers: TEAM_MEMBERS });
});

router.get('/:id', (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) {
    return res.status(404).json({ error: 'ticket not found' });
  }
  res.json(ticket);
});

router.patch('/:id', (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) {
    return res.status(404).json({ error: 'ticket not found' });
  }

  const { status, assignee } = req.body || {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    ticket.status = status;
  }
  if (assignee !== undefined) {
    const newAssignee = assignee || null;
    if (newAssignee && newAssignee !== ticket.assignee) {
      ticket.assignee = newAssignee;
      notifyAssignee(ticket);
    } else {
      ticket.assignee = newAssignee;
    }
  }

  res.json(ticket);
});

router.delete('/:id', (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) {
    return res.status(404).json({ error: 'ticket not found' });
  }

  ticket.archived = true;
  res.json(ticket);
});

module.exports = router;
