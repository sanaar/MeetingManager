const { createApp } = require('./app');
const { getDb }     = require('./db');

const PORT = process.env.PORT || 3001;
const db   = getDb();
const app  = createApp(db);

app.listen(PORT, () => {
  console.log(`Meeting Manager API running on http://localhost:${PORT}`);
});
