import { assertCoreEnv, config } from './config/env.js';
import app from './app.js';

assertCoreEnv();

app.listen(config.port, () => {
  console.log(`Book generation API listening on http://localhost:${config.port}`);
});
