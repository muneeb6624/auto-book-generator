import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from '../docs/openapi.js';

const router = Router();

router.get('/openapi.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(buildOpenApiSpec(req));
});

// `serve` is an array of middleware; spread so static assets (swagger-ui-*.js) are registered.
const serveStack = Array.isArray(swaggerUi.serve) ? swaggerUi.serve : [swaggerUi.serve];

router.use(
  '/',
  ...serveStack,
  swaggerUi.setup(undefined, {
    swaggerOptions: {
      url: '/api-docs/openapi.json',
      persistAuthorization: true,
    },
    customSiteTitle: 'Book API docs',
  })
);

export default router;
