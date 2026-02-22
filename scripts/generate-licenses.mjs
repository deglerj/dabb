#!/usr/bin/env node
// Auto-generates license lists for web and mobile apps.
// Run with: pnpm generate-licenses
// Also runs automatically after pnpm install (postinstall hook).

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const OUTPUT_FILES = [
  join(repoRoot, 'apps/web/src/generated/licenses.ts'),
  join(repoRoot, 'apps/mobile/src/generated/licenses.ts'),
];

function main() {
  const json = execSync('pnpm licenses list --prod --json', {
    cwd: repoRoot,
    encoding: 'utf-8',
  });

  /** @type {Record<string, { name: string }[]>} */
  const raw = JSON.parse(json);

  /** @type {{ license: string; packages: string[] }[]} */
  const licenseGroups = Object.entries(raw)
    .map(([license, packages]) => ({
      license,
      packages: packages
        .map((p) => p.name)
        .filter((name) => !name.startsWith('@dabb/'))
        .sort((a, b) => a.localeCompare(b)),
    }))
    .filter((g) => g.packages.length > 0)
    .sort((a, b) => a.license.localeCompare(b.license));

  const groupLines = licenseGroups
    .map((group) => {
      const pkgs = group.packages.map((p) => `'${p}'`).join(', ');
      return `  { license: '${group.license}', packages: [${pkgs}] },`;
    })
    .join('\n');

  const content =
    `// Auto-generated. Run 'pnpm generate-licenses' to regenerate.\n` +
    `export const licenseGroups: { license: string; packages: string[] }[] = [\n` +
    groupLines +
    `\n];\n`;

  for (const outputFile of OUTPUT_FILES) {
    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, content, 'utf-8');
    console.log(`Written: ${outputFile}`);
  }

  execSync(`pnpm prettier --write ${OUTPUT_FILES.join(' ')}`, {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

main();
