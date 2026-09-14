import { execSync } from 'node:child_process';

const baseUrl = process.env.PRODUCTION_URL || 'https://nalichat.org';
const expectedSha = (process.env.EXPECTED_SHA || execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()).trim();

async function main() {
  const bust = Date.now();
  const htmlResponse = await fetch(`${baseUrl}/?deploy_check=${bust}`, {
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
    redirect: 'follow',
  });
  if (!htmlResponse.ok) {
    throw new Error(`Production HTML returned HTTP ${htmlResponse.status}`);
  }
  const html = await htmlResponse.text();
  const match = html.match(/<script[^>]+src=["']([^"']+index-[^"']+\.js)["']/i);
  if (!match) {
    throw new Error('Could not locate the production entry bundle.');
  }

  const assetUrl = new URL(match[1], baseUrl);
  assetUrl.searchParams.set('deploy_check', String(bust));
  const assetResponse = await fetch(assetUrl, {
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  });
  if (!assetResponse.ok) {
    throw new Error(`Production entry bundle returned HTTP ${assetResponse.status}`);
  }
  const bundle = await assetResponse.text();

  if (!bundle.includes(expectedSha)) {
    console.error(`Production drift detected. Expected commit ${expectedSha}, but ${assetUrl.pathname} does not contain that build fingerprint.`);
    process.exit(1);
  }

  console.log(`Production matches commit ${expectedSha} (${assetUrl.pathname}).`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
