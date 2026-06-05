import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function findSplit(dir) {
  let results = [];
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      results = results.concat(await findSplit(full));
    } else if (f.isFile() && (full.endsWith('.js') || full.endsWith('.jsx'))) {
      const content = await fs.readFile(full, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('.split(')) {
          results.push(`${full}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
  return results;
}

Deno.serve(async (req) => {
    try {
        const results = await findSplit('./src');
        return Response.json({ results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});