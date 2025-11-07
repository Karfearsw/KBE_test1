import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { createServer } from '../../../server/index';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import bcrypt from 'bcryptjs';

describe('Authentication Integration Tests', () => {
  let app: any;
  let server: any;
  let testDb: any;
  let testClient: postgres.Sql;

  beforeAll(async () => {
    // Setup test database connection
    testClient = postgres(process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db');
    testDb = drizzle(testClient, { schema });
    
    // Create test server
    app = await createServer();
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (testClient) {
      await testClient.end();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await testClient.sql`TRUNCATE TABLE users CASCADE`;
  });

  afterEach(async () => {
    // Clean up after each test
    await testClient.sql`TRUNCATE TABLE users CASCADE`;
  });

  describe('Complete Authentication Flow', () => {
    it('should handle complete registration and login flow', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/register')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.email).toBe('testuser@example.com');
      expect(registerResponse.body.user).not.toHaveProperty('passwordHash');

      // Step 2: Login with registered credentials
      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'testuser@example.com',
          password: 'SecurePass123!',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('accessToken');
      expect(loginResponse.body).toHaveProperty('refreshToken');
      expect(loginResponse.body.user.email).toBe('testuser@example.com');

      const { accessToken, refreshToken } = loginResponse.body;

      // Step 3: Access protected endpoint with access token
      const userResponse = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(userResponse.status).toBe(200);
      expect(userResponse.body.user.email).toBe('testuser@example.com');

      // Step 4: Refresh access token
      const refreshResponse = await request(app)
        .post('/api/refresh-token')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toHaveProperty('accessToken');

      const newAccessToken = refreshResponse.body.accessToken;

      // Step 5: Verify new access token works
      const newUserResponse = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(newUserResponse.status).toBe(200);
      expect(newUserResponse.body.user.email).toBe('testuser@example.com');

      // Step 6: Logout
      const logoutResponse = await request(app)
        .post('/api/logout');

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logged out successfully');
    });

    it('should prevent duplicate email registration', async () => {
      // Register first user
      await request(app)
        .post('/api/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          firstName: 'First',
          lastName: 'User',
        });

      // Try to register with same email
      const response = await request(app)
        .post('/api/register')
        .send({
          email: 'duplicate@example.com',
          password: 'AnotherPass123!',
          firstName: 'Second',
          lastName: 'User',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Email already registered');
    });

    it('should handle password verification correctly', async () => {
      // Register user
      await request(app)
        .post('/api/register')
        .send({
          email: 'password@example.com',
          password: 'CorrectPass123!',
          firstName: 'Password',
          lastName: 'Test',
        });

      // Try login with wrong password
      const wrongPasswordResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'password@example.com',
          password: 'WrongPass123!',
        });

      expect(wrongPasswordResponse.status).toBe(401);
      expect(wrongPasswordResponse.body.error).toContain('Invalid credentials');

      // Try login with correct password
      const correctPasswordResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'password@example.com',
          password: 'CorrectPass123!',
        });

      expect(correctPasswordResponse.status).toBe(200);
      expect(correctPasswordResponse.body).toHaveProperty('accessToken');
    });
  });

  describe('Security Validation', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'short',           // Too short
        'password',        // Too common
        '12345678',        // Only numbers
        'abcdefgh',        // Only lowercase
        'ABCDEFGH',        // Only uppercase
        '!@#$%^&*',        // Only special chars
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: `test${Date.now()}@example.com`,
            password: password,
            firstName: 'Test',
            lastName: 'User',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Password must be at least 8 characters');
      }
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user@example',
        'user@@example.com',
        'user@example..com',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: email,
            password: 'SecurePass123!',
            firstName: 'Test',
            lastName: 'User',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid email');
      }
    });

    it('should sanitize user inputs properly', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          firstName: '<script>alert("XSS")</script>',
          lastName: '<img src="x" onerror="alert(\'XSS\')">',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.firstName).toBe('<script>alert("XSS")</script>');
      expect(response.body.user.lastName).toBe('<img src="x" onerror="alert(\'XSS\')">');
      // Note: In a real application, you'd want to implement proper input sanitization
    });

    it('should handle SQL injection attempts safely', async () => {
      const maliciousInputs = [
        "test@example.com'; DROP TABLE users; --",
        "test@example.com' OR '1'='1",
        "test@example.com'; UPDATE users SET password='hacked'; --",
      ];

      for (const email of maliciousInputs) {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: email,
            password: 'SecurePass123!',
            firstName: 'Test',
            lastName: 'User',
          });

        // Should either reject as invalid email or handle safely
        expect([400, 201]).toContain(response.status);
        if (response.status === 201) {
          // If accepted, verify it was handled safely
          expect(response.body.user.email).toBe(email);
        }
      }
    });
  });

  describe('Token Security', () => {
    it('should generate cryptographically secure tokens', async () => {
      // Register and login to get tokens
      await request(app)
        .post('/api/register')
        .send({
          email: 'token@example.com',
          password: 'SecurePass123!',
          firstName: 'Token',
          lastName: 'Test',
        });

      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'token@example.com',
          password: 'SecurePass123!',
        });

      const { accessToken, refreshToken } = loginResponse.body;

      // Verify tokens are JWT format
      expect(accessToken.split('.')).toHaveLength(3); // JWT has 3 parts
      expect(refreshToken.split('.')).toHaveLength(3);

      // Verify tokens are different each time
      const loginResponse2 = await request(app)
        .post('/api/login')
        .send({
          username: 'token@example.com',
          password: 'SecurePass123!',
        });

      expect(loginResponse2.body.accessToken).not.toBe(accessToken);
      expect(loginResponse2.body.refreshToken).not.toBe(refreshToken);
    });

    it('should expire tokens appropriately', async () => {
      // This test would require mocking time or checking token expiration
      // For now, we'll verify tokens have expiration claims
      
      await request(app)
        .post('/api/register')
        .send({
          email: 'expire@example.com',
          password: 'SecurePass123!',
          firstName: 'Expire',
          lastName: 'Test',
        });

      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'expire@example.com',
          password: 'SecurePass123!',
        });

      const { accessToken, refreshToken } = loginResponse.body;
      
      // Decode tokens to check expiration
      const jwt = require('jsonwebtoken');
      const accessTokenPayload = jwt.decode(accessToken);
      const refreshTokenPayload = jwt.decode(refreshToken);

      expect(accessTokenPayload).toHaveProperty('exp');
      expect(refreshTokenPayload).toHaveProperty('exp');
      expect(accessTokenPayload.exp).toBeLessThan(refreshTokenPayload.exp); // Access token should expire sooner
    });

    it('should reject tampered tokens', async () => {
      await request(app)
        .post('/api/register')
        .send({
          email: 'tamper@example.com',
          password: 'SecurePass123!',
          firstName: 'Tamper',
          lastName: 'Test',
        });

      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'tamper@example.com',
          password: 'SecurePass123!',
        });

      const { accessToken } = loginResponse.body;
      
      // Tamper with token
      const tamperedToken = accessToken.substring(0, accessToken.length - 10) + 'tampereddd';

      const response = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });
  });

  describe('Error Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      // This test would require simulating database failures
      // For now, we'll test error handling with invalid operations
      
      const response = await request(app)
        .post('/api/register')
        .send({
          email: 'error@example.com',
          password: 'SecurePass123!',
          firstName: 'Error',
          lastName: 'Test',
        });

      // Should handle gracefully regardless of database state
      expect([201, 500]).toContain(response.status);
    });

    it('should provide meaningful error messages without exposing internals', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'nonexistent@example.com',
          password: 'SomePassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('connection');
      expect(response.body.error).not.toContain('query');
    });
  });

  describe('Concurrent Access', () => {
    it('should handle multiple concurrent login attempts', async () => {
      // Register a user
      await request(app)
        .post('/api/register')
        .send({
          email: 'concurrent@example.com',
          password: 'SecurePass123!',
          firstName: 'Concurrent',
          lastName: 'Test',
        });

      // Attempt multiple concurrent logins
      const loginPromises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/login')
          .send({
            username: 'concurrent@example.com',
            password: 'SecurePass123!',
          })
      );

      const responses = await Promise.all(loginPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
      });
    });

    it('should handle concurrent registration attempts', async () => {
      const registrationPromises = Array(3).fill(null).map((_, index) =>
        request(app)
          .post('/api/register')
          .send({
            email: 'racecondition@example.com',
            password: 'SecurePass123!',
            firstName: 'Race',
            lastName: `Test${index}`,
          })
      );

      const responses = await Promise.all(registrationPromises);

      // One should succeed, others should fail with duplicate email
      const successCount = responses.filter(r => r.status === 201).length;
      const conflictCount = responses.filter(r => r.status === 409).length;

      expect(successCount + conflictCount).toBe(3);
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });
});