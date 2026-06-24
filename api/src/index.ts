import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Routes
app.get('/api/monsters/:speciesId', (req, res) => {
  const { speciesId } = req.params;
  // TODO: fetch from species registry on-chain
  res.json({ speciesId: Number(speciesId), name: `Monster #${speciesId}` });
});

app.get('/api/battles/active', (_req, res) => {
  // TODO: query active battles from DB
  res.json({ battles: [] });
});

app.get('/api/marketplace/listings', (_req, res) => {
  // TODO: query marketplace listings
  res.json({ listings: [] });
});

app.get('/api/leaderboard', (_req, res) => {
  // TODO: query top players by ELO
  res.json({ players: [] });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SOLMON API running on port ${PORT}`);
});
