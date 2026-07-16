import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicStatusService } from './music-status.mjs';

test('reports verified Echo Music entry points when the service is online', async () => {
  const service = createMusicStatusService({
    baseUrl: 'http://127.0.0.1:4175/',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ productName: 'Echo Music', version: '1.1.1' }),
    }),
  });

  assert.deepEqual(await service.getStatus(), {
    available: true,
    productName: 'Echo Music',
    version: '1.1.1',
    landingUrl: 'http://127.0.0.1:4175/',
    appUrl: 'http://127.0.0.1:4175/app',
    downloadUrl: 'http://127.0.0.1:4175/download/windows',
  });
});

test('does not expose dead links when Echo Music is offline', async () => {
  const service = createMusicStatusService({
    onError: () => {},
    fetchImpl: async () => { throw new Error('offline'); },
  });

  assert.deepEqual(await service.getStatus(), {
    available: false,
    productName: 'Echo Music',
    version: null,
    landingUrl: null,
    appUrl: null,
    downloadUrl: null,
  });
});

test('keeps configured public entry points available while a free service wakes', async () => {
  let probes = 0;
  const service = createMusicStatusService({
    baseUrl: 'https://aolined-echo-music.onrender.com/',
    publiclyHosted: true,
    fetchImpl: async () => { probes += 1; throw new Error('sleeping'); },
  });

  assert.deepEqual(await service.getStatus(), {
    available: true,
    deployment: 'public',
    productName: 'Echo Music',
    version: '1.1.1',
    landingUrl: 'https://aolined-echo-music.onrender.com/',
    appUrl: 'https://aolined-echo-music.onrender.com/app',
    downloadUrl: 'https://aolined-echo-music.onrender.com/download/windows',
  });
  assert.equal(probes, 0);
});
