import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import docsRoutes from './routes/docsRoutes.js';
import bookRoutes from './routes/bookRoutes.js';
import chapterRoutes from './routes/chapterRoutes.js';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'book-generation-api' });
});

// Only redirect the bare path. `app.get('/api-docs')` matches normalized `/api-docs/` too → redirect loop.
function redirectApiDocsBarePath(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const pathname = req.originalUrl.split('?')[0];
  if (pathname === '/api-docs') return res.redirect(302, '/api-docs/');
  next();
}

app.use('/api-docs', redirectApiDocsBarePath, docsRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/chapters', chapterRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

export default app;
