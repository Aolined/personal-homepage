'use strict';

function weatherError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeChineseCityName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/(?:市|自治州|地区|盟)$/u, '');
}

function parseJsonEnvelope(payload, startToken, endToken, errorCode) {
  const text = String(payload || '').replace(/^\uFEFF/, '').trim();
  const start = text.indexOf(startToken);
  const end = text.lastIndexOf(endToken);
  if (start < 0 || end < start) throw weatherError(errorCode);
  try {
    return JSON.parse(text.slice(start, end + endToken.length));
  } catch (error) {
    throw weatherError(errorCode);
  }
}

function parseWeatherComSearch(payload, city) {
  const target = normalizeChineseCityName(city);
  const items = parseJsonEnvelope(payload, '[', ']', 'CHINA_WEATHER_CITY_NOT_FOUND');
  if (!target || !Array.isArray(items)) throw weatherError('CHINA_WEATHER_CITY_NOT_FOUND');
  const candidates = items.map(item => {
    const parts = String(item && item.ref || '').split('~');
    const code = parts[0] || '';
    const name = parts[2] || '';
    const alternateName = parts[4] || '';
    const province = parts[9] || '';
    const normalizedName = normalizeChineseCityName(name);
    const normalizedAlternate = normalizeChineseCityName(alternateName);
    let score = 0;
    if (normalizedName === target) score += 8;
    if (normalizedAlternate === target) score += 4;
    if (normalizedName.startsWith(target) || target.startsWith(normalizedName)) score += 1;
    if (/^101\d{6}$/.test(code)) score += 2;
    return { code, name, province, score };
  }).filter(item => /^101\d{6}$/.test(item.code) && item.score > 2);
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates[0]) throw weatherError('CHINA_WEATHER_CITY_NOT_FOUND');
  return { code: candidates[0].code, name: candidates[0].name, province: candidates[0].province };
}

function weatherCodeForLabel(label) {
  const text = String(label || '').trim();
  if (/雷/.test(text)) return 95;
  if (/暴雪|大雪/.test(text)) return 75;
  if (/中雪/.test(text)) return 73;
  if (/雪/.test(text)) return 71;
  if (/暴雨|大雨/.test(text)) return 65;
  if (/中雨/.test(text)) return 63;
  if (/阵雨/.test(text)) return 80;
  if (/雨/.test(text)) return 61;
  if (/雾|霾/.test(text)) return 45;
  if (/阴/.test(text)) return 3;
  if (/多云/.test(text)) return 2;
  if (/晴/.test(text)) return 0;
  return 1;
}

function apparentTemperatureC(temperature, humidity) {
  const tempC = Number(temperature);
  const rh = Number(humidity);
  if (!Number.isFinite(tempC) || !Number.isFinite(rh) || tempC < 27 || rh < 40) return tempC;
  const t = tempC * 9 / 5 + 32;
  const hi = -42.379 + 2.04901523 * t + 10.14333127 * rh
    - 0.22475541 * t * rh - 0.00683783 * t * t - 0.05481717 * rh * rh
    + 0.00122874 * t * t * rh + 0.00085282 * t * rh * rh
    - 0.00000199 * t * t * rh * rh;
  return Math.round(((hi - 32) * 5 / 9) * 10) / 10;
}

function parseWeatherComObservation(payload) {
  const body = parseJsonEnvelope(payload, '{', '}', 'CHINA_WEATHER_OBSERVATION_INVALID');
  const temperature = Number(body.temp);
  const humidity = Number.parseFloat(String(body.SD || body.sd || '').replace('%', ''));
  const label = String(body.weather || body.weathere || '').trim();
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity) || !label) {
    throw weatherError('CHINA_WEATHER_OBSERVATION_INVALID');
  }
  const rain = Number(body.rain);
  const windSpeed = Number.parseFloat(String(body.wse || '').replace(/[^\d.]/g, ''));
  return {
    provider: 'weather.com.cn',
    stationCode: String(body.city || ''),
    city: String(body.cityname || ''),
    label,
    weatherCode: weatherCodeForLabel(label),
    temperature,
    apparentTemperature: apparentTemperatureC(temperature, humidity),
    humidity,
    precipitation: Number.isFinite(rain) ? rain : 0,
    windSpeed: Number.isFinite(windSpeed) ? windSpeed : null,
    observationTime: String(body.time || ''),
  };
}

module.exports = {
  normalizeChineseCityName,
  parseWeatherComSearch,
  parseWeatherComObservation,
  apparentTemperatureC,
};
