import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from '../docs/openapi.js';

const router = Router();

// Stops express.static from 301/302 between /api-docs and /api-docs/, which caused ERR_TOO_MANY_REDIRECTS
// with our bare-path redirect. Same stack as swagger-ui-express `serve`, with options forwarded to static.
const serve =
  typeof swaggerUi.serveWithOptions === 'function'
    ? swaggerUi.serveWithOptions({ redirect: false })
    : Array.isArray(swaggerUi.serve)
      ? swaggerUi.serve
      : [swaggerUi.serve];

function attachSpec(req, res, next) {
  req.swaggerDoc = buildOpenApiSpec(req);
  next();
}

router.use(
  ...serve,
  attachSpec,
  swaggerUi.setup(undefined, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Book API docs',
  })
);

export default router;
