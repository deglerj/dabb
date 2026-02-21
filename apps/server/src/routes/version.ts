import { Router } from 'express';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const pkg = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf-8')
) as { version: string };

export const versionRouter: Router = Router();

versionRouter.get('/', (_req, res) => {
  res.json({ version: pkg.version });
});
