import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { dispatchInterviewBriefRequest } from '../workers/sessionCorsWorker/interviewBriefDispatch.js';
import { readKickoffVersions, verifyInterviewCatalogCompatibility } from './verify-interview-catalog-compat.mjs';

test('reads the kickoff requirement without treating legacy import versions as supported kickoff versions', () => {
  const source = 'const v="ce-interview-brief-v5"; const legacy=["ce-interview-brief-v1","ce-interview-brief-v4"];`Require prefillPromptVersion "${v}"; otherwise stop`';
  assert.deepEqual(readKickoffVersions(source), ['ce-interview-brief-v5']);
  assert.deepEqual(readKickoffVersions(source.replace('"${v}";', '"ce-interview-brief-v4" or "${v}";')), ['ce-interview-brief-v4', 'ce-interview-brief-v5']);
  assert.throws(() => readKickoffVersions('prefillPromptVersion "${unknown}"; otherwise stop'), /Cannot resolve/);
});

test('checks a served client against the real local Worker catalog handler using GET only', async (t) => {
  let origin;
  let clientVersion = 'ce-interview-brief-v5';
  const server = createServer(async (req, res) => {
    assert.equal(req.method, 'GET');
    if (req.url.startsWith('/session/')) { res.end('<script type="module" src="/assets/index.js"></script>'); return; }
    if (req.url === '/assets/index.js') { res.end('import("./SurveyPileViewMode.js")'); return; }
    if (req.url === '/assets/SurveyPileViewMode.js') { res.end(`const v="${clientVersion}";\`Require prefillPromptVersion "\${v}"; otherwise stop\``); return; }
    const result = await dispatchInterviewBriefRequest({
      request: new Request(`${origin}${req.url}`), env: {}, baseHeaders: {},
      deps: {
        resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
        getSessionConfig: async () => ({ slug: 'demo', allowOrigins: [origin] }),
        getCorsContext: async () => ({ ok: true, headers: {} }),
        loadPublicInterviewQuestions: async () => [{ id: 'q1', prompt: 'Example?', type: 'freeform' }],
        json: (body, status, headers) => new Response(JSON.stringify(body), { status, headers }),
      },
    });
    res.writeHead(result.status); res.end(await result.text());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const options = { sessionUrl: `${origin}/session/demo`, workerUrl: origin };
  assert.equal((await verifyInterviewCatalogCompatibility(options)).compatible, true);
  clientVersion = 'ce-interview-brief-v4';
  assert.equal((await verifyInterviewCatalogCompatibility(options)).compatible, false);
});
