const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseCoordinates,
  reverseLocationCacheKey,
  normalizeReverseLocation,
} = require('../scripts/weather-location');

test('validates reverse-location coordinates without silently clamping them', () => {
  assert.deepEqual(parseCoordinates('34.7466', '113.6254'), {
    latitude: 34.7466,
    longitude: 113.6254,
  });
  assert.throws(() => parseCoordinates('91', '113.6'), /INVALID_COORDINATES/);
  assert.throws(() => parseCoordinates('34.7', ''), /INVALID_COORDINATES/);
  assert.throws(() => parseCoordinates('not-a-number', '113.6'), /INVALID_COORDINATES/);
});

test('normalizes a precise Chinese city and district label', () => {
  const location = normalizeReverseLocation({
    address: {
      city: '郑州市',
      city_district: '金水区',
      state: '河南省',
      country: '中国',
    },
  }, 34.7466, 113.6254);

  assert.deepEqual(location, {
    provider: 'openstreetmap',
    city: '郑州市',
    district: '金水区',
    name: '郑州市 · 金水区',
    region: '河南省',
    country: '中国',
    latitude: 34.7466,
    longitude: 113.6254,
  });
});

test('normalizes BigDataCloud city hierarchy for direct-administered cities', () => {
  const location = normalizeReverseLocation({
    countryName: '中华人民共和国',
    principalSubdivision: '北京市',
    city: '北京市',
    locality: '东城区',
  }, 39.9042, 116.4074);

  assert.equal(location.provider, 'bigdatacloud');
  assert.equal(location.city, '北京市');
  assert.equal(location.district, '东城区');
  assert.equal(location.name, '北京市');
});

test('falls back through town and county fields and caches nearby coordinates together', () => {
  const location = normalizeReverseLocation({
    address: { town: '昆山市', county: '苏州市', state: '江苏省' },
  }, 31.385, 120.981);

  assert.equal(location.city, '昆山市');
  assert.equal(location.district, '苏州市');
  assert.equal(location.name, '昆山市 · 苏州市');
  assert.equal(reverseLocationCacheKey(31.38521, 120.98142), '31.385,120.981');
  assert.equal(reverseLocationCacheKey(31.38529, 120.98149), '31.385,120.981');
});

test('rejects reverse-geocoder payloads without a usable place name', () => {
  assert.throws(
    () => normalizeReverseLocation({ address: { country_code: 'cn' } }, 30, 120),
    /REVERSE_LOCATION_NOT_FOUND/
  );
});
