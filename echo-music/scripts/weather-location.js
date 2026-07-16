'use strict';

function invalidCoordinates() {
  const error = new Error('INVALID_COORDINATES');
  error.code = 'INVALID_COORDINATES';
  return error;
}

function parseCoordinates(lat, lon) {
  if (lat === null || lat === undefined || lat === '' ||
      lon === null || lon === undefined || lon === '') {
    throw invalidCoordinates();
  }
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw invalidCoordinates();
  }
  return { latitude, longitude };
}

function reverseLocationCacheKey(lat, lon) {
  const { latitude, longitude } = parseCoordinates(lat, lon);
  return latitude.toFixed(3) + ',' + longitude.toFixed(3);
}

function cleanPlaceName(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
}

function firstPlace(address, fields) {
  for (const field of fields) {
    const value = cleanPlaceName(address[field]);
    if (value) return value;
  }
  return '';
}

function normalizeReverseLocation(payload, lat, lon) {
  const { latitude, longitude } = parseCoordinates(lat, lon);
  if (payload && typeof payload === 'object' && !payload.address) {
    const city = cleanPlaceName(payload.city || payload.locality || payload.principalSubdivision);
    if (!city) {
      const error = new Error('REVERSE_LOCATION_NOT_FOUND');
      error.code = 'REVERSE_LOCATION_NOT_FOUND';
      throw error;
    }
    const locality = cleanPlaceName(payload.locality);
    const district = locality && locality !== city ? locality : '';
    return {
      provider: 'bigdatacloud',
      city,
      district,
      name: city,
      region: cleanPlaceName(payload.principalSubdivision),
      country: cleanPlaceName(payload.countryName),
      latitude,
      longitude,
    };
  }
  const address = payload && payload.address && typeof payload.address === 'object'
    ? payload.address
    : {};
  const city = firstPlace(address, [
    'city', 'town', 'municipality', 'county', 'state_district', 'state',
  ]);
  if (!city) {
    const error = new Error('REVERSE_LOCATION_NOT_FOUND');
    error.code = 'REVERSE_LOCATION_NOT_FOUND';
    throw error;
  }
  const districtCandidate = firstPlace(address, [
    'city_district', 'district', 'borough', 'suburb', 'county',
  ]);
  const district = districtCandidate && districtCandidate !== city ? districtCandidate : '';
  return {
    provider: 'openstreetmap',
    city,
    district,
    name: district ? city + ' · ' + district : city,
    region: cleanPlaceName(address.state || address.state_district),
    country: cleanPlaceName(address.country),
    latitude,
    longitude,
  };
}

module.exports = {
  parseCoordinates,
  reverseLocationCacheKey,
  normalizeReverseLocation,
};
