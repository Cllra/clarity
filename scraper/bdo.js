const axios = require('axios');

const BDO_API = process.env.BDO_API_URL || 'http://localhost:8001';
const REGION  = process.env.REGION      || 'EU';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// bdo-api antwortet selbst mit 429, sobald -maxtasksperclient (Default 5)
// Aufgaben hängen. Das passiert, wenn BDO die IP des Runners drosselt — auf
// diesem Runner kommt dann nichts mehr durch.
class BlockedError extends Error {}

async function fetchWithRetry(url, params, retries = 12, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    let res;
    try {
      res = await axios.get(url, { params, timeout: 30000 });
    } catch (e) {
      if (e.response?.status === 429) throw new BlockedError('bdo-api 429 (Aufgaben hängen, IP gedrosselt)');
      throw e;
    }
    if (res.data?.status === 'started' || res.data?.status === 'pending') {
      console.log(`  polling ${i + 1}/${retries}...`);
      await sleep(delay);
      continue;
    }
    return res.data;
  }
  throw new Error(`Kein Ergebnis nach ${retries} Versuchen`);
}

module.exports = { BDO_API, REGION, sleep, BlockedError, fetchWithRetry };
