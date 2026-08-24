const express = require('express');
const ticketsRouter = require('./routes/tickets');
const notificationsRouter = require('./routes/notifications');

const app = express();
const port = process.env.PORT || 5001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tickets', ticketsRouter);
app.use('/api/notifications', notificationsRouter);

app.listen(port, '0.0.0.0', () => {
  console.log(`ticket-service listening on port ${port}`);
});
