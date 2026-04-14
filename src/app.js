import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import bookRoutes from './routes/bookRoutes.js';
import chapterRoutes from './routes/chapterRoutes.js';

const app = express();

app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'book-generation-api' });
});

app.use('/api/books', bookRoutes);
app.use('/api/chapters', chapterRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

export default app;
