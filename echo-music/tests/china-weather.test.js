const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeChineseCityName,
  parseWeatherComSearch,
  parseWeatherComObservation,
  apparentTemperatureC,
} = require('../scripts/china-weather');

test('selects the exact Chinese city station instead of a similarly named attraction', () => {
  const payload = `([{"ref":"101181401~henan~周口~Zhoukou~周口~Zhoukou~394~466000~ZK~河南"},{"ref":"10101120009A~beijing~周口店遗址~Zhoukoudian~周口店遗址~Zhoukoudian~null~102400~null~北京市景点"}])`;

  assert.equal(normalizeChineseCityName('周口市'), '周口');
  assert.deepEqual(parseWeatherComSearch(payload, '周口市'), {
    code: '101181401',
    name: '周口',
    province: '河南',
  });
});

test('parses a weather.com.cn current station observation', () => {
  const payload = 'var dataSK={"cityname":"周口","city":"101181401","temp":"37.1","SD":"48%","time":"15:55","rain":"0","weather":"多云","weathere":"Cloudy","wse":"4km/h"}';
  const observation = parseWeatherComObservation(payload);

  assert.equal(observation.provider, 'weather.com.cn');
  assert.equal(observation.label, '多云');
  assert.equal(observation.weatherCode, 2);
  assert.equal(observation.temperature, 37.1);
  assert.equal(observation.humidity, 48);
  assert.equal(observation.precipitation, 0);
  assert.equal(observation.windSpeed, 4);
  assert.equal(observation.observationTime, '15:55');
});

test('calculates a heat-index apparent temperature for hot humid observations', () => {
  assert.equal(apparentTemperatureC(20, 50), 20);
  assert.ok(apparentTemperatureC(37.1, 48) > 40);
});

test('rejects malformed weather station responses', () => {
  assert.throws(() => parseWeatherComSearch('callback([])', '周口市'), /CHINA_WEATHER_CITY_NOT_FOUND/);
  assert.throws(() => parseWeatherComObservation('var dataSK={}'), /CHINA_WEATHER_OBSERVATION_INVALID/);
});
