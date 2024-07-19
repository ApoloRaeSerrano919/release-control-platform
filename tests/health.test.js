const request = require('supertest');
const app = require('../src/app');

test('health endpoint', async () => {
  const response = await request(app).get('/health');
  expect(response.status).toBe(200);
  expect(response.body.status).toBe('ok');
});
