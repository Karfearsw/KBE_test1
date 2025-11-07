import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../server/index';

describe('Analytics API Integration Tests', () => {
  let server: any;
  let authToken: string;

  beforeEach(async () => {
    // Setup test server
    server = app.listen(0); // Use random port
    
    // Get auth token for protected routes
    const loginResponse = await request(server)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    authToken = loginResponse.body.token;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('GET /api/analytics/dashboard', () => {
    it('should return analytics dashboard data', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('charts');
    });

    it('should require authentication', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/performance', () => {
    it('should return performance metrics', async () => {
      const response = await request(server)
        .get('/api/analytics/performance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cpuUsage');
      expect(response.body).toHaveProperty('memoryUsage');
      expect(response.body).toHaveProperty('responseTime');
    });
  });

  describe('GET /api/analytics/team-activity', () => {
    it('should return team activity data', async () => {
      const response = await request(server)
        .get('/api/analytics/team-activity')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activities');
      expect(response.body).toHaveProperty('teamMembers');
    });
  });
});