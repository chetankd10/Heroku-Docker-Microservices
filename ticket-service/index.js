const express = require('express');
const ticketsRouter = require('./routes/tickets');

const app = express();
const port = process.env.PORT || 5001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tickets', ticketsRouter);

app.listen(port, '0.0.0.0', () => {
  console.log(`ticket-service listening on port ${port}`);
});
