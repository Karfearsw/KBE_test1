# Production Testing Strategy

## Overview
This document outlines the comprehensive testing strategy for the production-ready application, covering all critical components including CORS configuration, email verification, health monitoring, database operations, security measures, and logging systems.

## Testing Environment Setup

### Test Environment Configuration
```bash
# Test environment variables
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
JWT_SECRET=test-secret-key
SENDGRID_API_KEY=test-sendgrid-key
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
LOG_LEVEL=debug
```

### Test Database Setup
```sql
-- Create test database
CREATE DATABASE test_db;
GRANT ALL PRIVILEGES ON DATABASE test_db TO test;

-- Run migrations on test database
npm run migrate:test
```

## Unit Testing

### 1. CORS Configuration Tests
```javascript
// tests/unit/cors.test.js
describe('CORS Configuration', () => {
  test('should allow Vercel domains', () => {
    const allowedOrigins = [
      'https://myapp.vercel.app',
      'https://myapp-git-main-username.vercel.app',
      'https://myapp-feature-branch-username.vercel.app'
    ];
    
    allowedOrigins.forEach(origin => {
      expect(isOriginAllowed(origin)).toBe(true);
    });
  });
  
  test('should block unauthorized domains', () => {
    const blockedOrigins = [
      'https://malicious-site.com',
      'https://phishing-site.vercel.app.evil.com'
    ];
    
    blockedOrigins.forEach(origin => {
      expect(isOriginAllowed(origin)).toBe(false);
    });
  });
  
  test('should handle preflight requests correctly', () => {
    const req = { method: 'OPTIONS' };
    const res = {
      header: jest.fn(),
      sendStatus: jest.fn()
    };
    
    handlePreflight(req, res);
    
    expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });
});
```

### 2. Email Verification Tests
```javascript
// tests/unit/emailVerification.test.js
describe('Email Verification Service', () => {
  beforeEach(async () => {
    await clearDatabase();
  });
  
  test('should generate unique tokens', () => {
    const token1 = EmailVerificationService.generateToken();
    const token2 = EmailVerificationService.generateToken();
    
    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });
  
  test('should create verification token with 24-hour expiry', async () => {
    const userId = 'test-user-id';
    const email = 'test@example.com';
    
    const result = await EmailVerificationService.createVerificationToken(userId, email);
    
    expect(result.token).toBeDefined();
    expect(result.expiresAt).toBeInstanceOf(Date);
    
    const expiryTime = result.expiresAt.getTime();
    const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
    expect(expiryTime).toBeGreaterThan(Date.now());
    expect(expiryTime).toBeLessThanOrEqual(expectedExpiry + 1000);
  });
  
  test('should validate token correctly', async () => {
    const userId = 'test-user-id';
    const email = 'test@example.com';
    
    const { token } = await EmailVerificationService.createVerificationToken(userId, email);
    const validation = await EmailVerificationService.verifyToken(token);
    
    expect(validation.valid).toBe(true);
    expect(validation.verification.user_id).toBe(userId);
  });
  
  test('should reject expired tokens', async () => {
    const expiredToken = 'expired-token-123';
    
    // Create expired token directly in database
    await supabase.from('email_verifications').insert([{
      user_id: 'test-user-id',
      token: expiredToken,
      expires_at: new Date(Date.now() - 1000).toISOString(),
      used: false
    }]);
    
    const validation = await EmailVerificationService.verifyToken(expiredToken);
    
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('expired');
  });
  
  test('should reject used tokens', async () => {
    const usedToken = 'used-token-123';
    
    // Create used token directly in database
    await supabase.from('email_verifications').insert([{
      user_id: 'test-user-id',
      token: usedToken,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      used: true
    }]);
    
    const validation = await EmailVerificationService.verifyToken(usedToken);
    
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('used');
  });
});
```

### 3. Health Monitoring Tests
```javascript
// tests/unit/healthMonitoring.test.js
describe('Health Monitoring Service', () => {
  test('should return healthy status when all services are operational', async () => {
    const health = await HealthService.checkHealth();
    
    expect(health.status).toBe('healthy');
    expect(health.timestamp).toBeDefined();
    expect(health.uptime).toBeGreaterThan(0);
    expect(health.services.database).toBe('healthy');
    expect(health.services.memory).toBe('healthy');
  });
  
  test('should detect database connection issues', async () => {
    // Mock database failure
    jest.spyOn(supabase, 'from').mockRejectedValue(new Error('Connection failed'));
    
    const health = await HealthService.checkHealth();
    
    expect(health.status).toBe('unhealthy');
    expect(health.services.database).toBe('unhealthy');
  });
  
  test('should collect system metrics correctly', async () => {
    const metrics = await MetricsCollector.collectMetrics();
    
    expect(metrics).toBeInstanceOf(Array);
    expect(metrics.length).toBeGreaterThan(0);
    
    const metricTypes = metrics.map(m => m.metric_type);
    expect(metricTypes).toContain('cpu_user_ms');
    expect(metricTypes).toContain('memory_heap_used_mb');
    expect(metricTypes).toContain('requests_total');
  });
  
  test('should calculate error rates correctly', () => {
    const metrics = [
      { metric_type: 'requests_total', value: 100 },
      { metric_type: 'requests_errors', value: 5 }
    ];
    
    const errorRate = MetricsCollector.calculateErrorRate(metrics);
    expect(errorRate).toBe(5);
  });
});
```

### 4. Rate Limiting Tests
```javascript
// tests/unit/rateLimiting.test.js
describe('Rate Limiting', () => {
  test('should allow requests within rate limit', async () => {
    const requests = Array(10).fill(null).map(() => ({
      ip: '192.168.1.1',
      timestamp: Date.now()
    }));
    
    requests.forEach(req => {
      expect(isRateLimited(req.ip)).toBe(false);
    });
  });
  
  test('should block requests exceeding rate limit', () => {
    const ip = '192.168.1.1';
    
    // Make 11 requests (exceeding limit of 10)
    for (let i = 0; i < 11; i++) {
      recordRequest(ip);
    }
    
    expect(isRateLimited(ip)).toBe(true);
  });
  
  test('should reset rate limit after window expires', () => {
    const ip = '192.168.1.1';
    const windowMs = 60 * 1000; // 1 minute
    
    // Make requests at limit
    for (let i = 0; i < 10; i++) {
      recordRequest(ip, Date.now() - windowMs - 1000);
    }
    
    // Should allow new requests after window
    expect(isRateLimited(ip)).toBe(false);
  });
});
```

## Integration Testing

### 1. Email Verification Flow
```javascript
// tests/integration/emailVerificationFlow.test.js
describe('Email Verification Flow', () => {
  test('should complete full verification flow', async () => {
    // 1. Register user
    const registrationResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
      });
    
    expect(registrationResponse.status).toBe(201);
    expect(registrationResponse.body.success).toBe(true);
    
    // 2. Check that verification email was sent
    const emailLogs = await getEmailLogs();
    expect(emailLogs).toHaveLength(1);
    expect(emailLogs[0].to).toBe('test@example.com');
    
    // 3. Extract verification token from email
    const verificationToken = extractTokenFromEmail(emailLogs[0].body);
    expect(verificationToken).toBeDefined();
    
    // 4. Verify email with token
    const verificationResponse = await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: verificationToken,
        email: 'test@example.com'
      });
    
    expect(verificationResponse.status).toBe(200);
    expect(verificationResponse.body.success).toBe(true);
    
    // 5. Verify user can now login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!'
      });
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeDefined();
  });
  
  test('should handle verification token expiration', async () => {
    // Create expired token
    const expiredToken = await createExpiredVerificationToken('test@example.com');
    
    const response = await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: expiredToken,
        email: 'test@example.com'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('expired');
  });
  
  test('should handle resend verification requests', async () => {
    // Register user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
      });
    
    // Wait for cooldown period
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Resend verification
    const resendResponse = await request(app)
      .post('/api/auth/resend-verification')
      .send({
        email: 'test@example.com'
      });
    
    expect(resendResponse.status).toBe(200);
    expect(resendResponse.body.success).toBe(true);
    
    // Verify new email was sent
    const emailLogs = await getEmailLogs();
    expect(emailLogs).toHaveLength(2);
  });
});
```

### 2. Health Monitoring Integration
```javascript
// tests/integration/healthMonitoring.test.js
describe('Health Monitoring Integration', () => {
  test('should return comprehensive health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.uptime).toBeGreaterThan(0);
    expect(response.body.services.database).toBe('healthy');
    expect(response.body.services.memory).toBe('healthy');
    expect(response.body.services.cpu).toBe('healthy');
  });
  
  test('should collect and store metrics', async () => {
    // Trigger some activity
    await request(app).get('/health').expect(200);
    await request(app).get('/api/users').expect(401); // Should still record
    
    // Wait for metrics collection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const metricsResponse = await request(app)
      .get('/health/metrics')
      .query({ timeRange: '1h' })
      .expect(200);
    
    expect(metricsResponse.body.success).toBe(true);
    expect(metricsResponse.body.data).toBeDefined();
    expect(metricsResponse.body.data.summary).toBeDefined();
  });
  
  test('should trigger alerts on threshold breach', async () => {
    // Simulate high error rate
    for (let i = 0; i < 10; i++) {
      await request(app).get('/api/nonexistent').expect(404);
    }
    
    // Wait for alert evaluation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const alerts = await getActiveAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(alert => alert.type === 'high_error_rate')).toBe(true);
  });
});
```

### 3. Security Headers and Rate Limiting
```javascript
// tests/integration/security.test.js
describe('Security Headers and Rate Limiting', () => {
  test('should include security headers in responses', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
  });
  
  test('should enforce rate limits', async () => {
    const ip = '192.168.1.100';
    
    // Make requests up to the limit
    for (let i = 0; i < 10; i++) {
      await request(app)
        .get('/health')
        .set('X-Forwarded-For', ip)
        .expect(200);
    }
    
    // Next request should be rate limited
    const limitedResponse = await request(app)
      .get('/health')
      .set('X-Forwarded-For', ip)
      .expect(429);
    
    expect(limitedResponse.body.message).toContain('Too many requests');
  });
  
  test('should handle CSRF protection', async () => {
    // Get CSRF token
    const csrfResponse = await request(app)
      .get('/api/csrf-token')
      .expect(200);
    
    const csrfToken = csrfResponse.body.token;
    
    // POST request without CSRF token should fail
    await request(app)
      .post('/api/users')
      .send({ name: 'Test User' })
      .expect(403);
    
    // POST request with valid CSRF token should succeed
    await request(app)
      .post('/api/users')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Test User' })
      .expect(201);
  });
});
```

## Performance Testing

### 1. Load Testing Configuration
```javascript
// tests/performance/loadTest.js
const { performance } = require('perf_hooks');

describe('Performance Tests', () => {
  test('should handle concurrent health check requests', async () => {
    const concurrentRequests = 100;
    const startTime = performance.now();
    
    const requests = Array(concurrentRequests).fill(null).map(() =>
      request(app).get('/health')
    );
    
    const responses = await Promise.all(requests);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // All requests should succeed
    expect(responses.every(r => r.status === 200)).toBe(true);
    
    // Average response time should be under 100ms
    const avgResponseTime = totalTime / concurrentRequests;
    expect(avgResponseTime).toBeLessThan(100);
    
    // No request should take more than 500ms
    expect(totalTime).toBeLessThan(concurrentRequests * 500);
  });
  
  test('should maintain performance under sustained load', async () => {
    const duration = 30000; // 30 seconds
    const requestsPerSecond = 10;
    const results = [];
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration) {
      const batchStart = performance.now();
      
      const batch = Array(requestsPerSecond).fill(null).map(() =>
        request(app).get('/health')
      );
      
      const batchResults = await Promise.all(batch);
      const batchEnd = performance.now();
      
      results.push({
        timestamp: Date.now(),
        responseTimes: batchResults.map(() => batchEnd - batchStart),
        successRate: batchResults.filter(r => r.status === 200).length / requestsPerSecond
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Calculate overall performance metrics
    const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
    const avgResponseTime = results.flatMap(r => r.responseTimes).reduce((sum, time) => sum + time, 0) / (results.length * requestsPerSecond);
    
    expect(avgSuccessRate).toBeGreaterThan(0.99); // 99% success rate
    expect(avgResponseTime).toBeLessThan(100); // Under 100ms average
  });
  
  test('should handle database connection pool efficiently', async () => {
    const concurrentDbRequests = 50;
    
    const requests = Array(concurrentDbRequests).fill(null).map(() =>
      request(app).get('/api/users').set('Authorization', 'Bearer valid-token')
    );
    
    const startTime = performance.now();
    const responses = await Promise.all(requests);
    const endTime = performance.now();
    
    expect(responses.every(r => r.status === 200)).toBe(true);
    
    const totalTime = endTime - startTime;
    const avgTimePerRequest = totalTime / concurrentDbRequests;
    
    // Database requests should be efficient
    expect(avgTimePerRequest).toBeLessThan(200);
  });
});
```

### 2. Memory Leak Detection
```javascript
// tests/performance/memoryLeaks.test.js
describe('Memory Leak Detection', () => {
  test('should not leak memory during extended operation', async () => {
    const initialMemory = process.memoryUsage();
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      // Simulate various operations
      await request(app).get('/health');
      await request(app).post('/api/auth/register').send({
        email: `test${i}@example.com`,
        password: 'TestPassword123!'
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be minimal (less than 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
  
  test('should clean up expired tokens efficiently', async () => {
    // Create expired tokens
    const expiredTokens = [];
    for (let i = 0; i < 100; i++) {
      const token = await createExpiredVerificationToken(`test${i}@example.com`);
      expiredTokens.push(token);
    }
    
    const beforeCleanup = await countVerificationTokens();
    
    // Run cleanup job
    await EmailVerificationService.cleanupExpiredTokens();
    
    const afterCleanup = await countVerificationTokens();
    
    expect(afterCleanup).toBeLessThan(beforeCleanup);
    expect(afterCleanup).toBe(0); // All expired tokens should be removed
  });
});
```

## Security Testing

### 1. SQL Injection Prevention
```javascript
// tests/security/sqlInjection.test.js
describe('SQL Injection Prevention', () => {
  test('should prevent SQL injection in email verification', async () => {
    const maliciousToken = "' OR '1'='1";
    
    const response = await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: maliciousToken,
        email: 'test@example.com'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
  
  test('should prevent SQL injection in user queries', async () => {
    const maliciousEmail = "test@example.com'; DROP TABLE users; --";
    
    const response = await request(app)
      .post('/api/auth/resend-verification')
      .send({
        email: maliciousEmail
      });
    
    expect(response.status).toBe(404); // User not found, but no injection
    expect(response.body.success).toBe(false);
  });
});
```

### 2. XSS Prevention
```javascript
// tests/security/xssPrevention.test.js
describe('XSS Prevention', () => {
  test('should sanitize user input in email templates', async () => {
    const maliciousName = '<script>alert("XSS")</script>';
    
    const sanitizedName = EmailTemplateService.sanitizeUserInput(maliciousName);
    expect(sanitizedName).not.toContain('<script>');
    expect(sanitizedName).toContain('&lt;script&gt;');
  });
  
  test('should escape HTML in API responses', async () => {
    const maliciousInput = '<script>alert("XSS")</script>';
    
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: maliciousInput
      });
    
    expect(response.status).toBe(201);
    expect(response.body.user.name).not.toContain('<script>');
  });
});
```

### 3. Authentication and Authorization
```javascript
// tests/security/authentication.test.js
describe('Authentication and Authorization', () => {
  test('should reject requests without valid JWT token', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .expect(401);
    
    expect(response.body.message).toContain('No token provided');
  });
  
  test('should reject requests with invalid JWT token', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    
    expect(response.body.message).toContain('Invalid token');
  });
  
  test('should enforce role-based access control', async () => {
    // Create regular user token
    const userToken = await createUserToken('user');
    
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    
    expect(response.body.message).toContain('Insufficient permissions');
  });
  
  test('should allow admin access with valid token', async () => {
    // Create admin user token
    const adminToken = await createUserToken('admin');
    
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });
});
```

## Monitoring and Alerting Tests

### 1. Alert Threshold Testing
```javascript
// tests/monitoring/alerts.test.js
describe('Alert System', () => {
  test('should trigger high error rate alert', async () => {
    // Generate errors to exceed threshold
    for (let i = 0; i < 20; i++) {
      await request(app).get('/api/nonexistent').expect(404);
    }
    
    // Wait for alert evaluation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const alerts = await getActiveAlerts();
    const highErrorRateAlert = alerts.find(alert => alert.type === 'high_error_rate');
    
    expect(highErrorRateAlert).toBeDefined();
    expect(highErrorRateAlert.severity).toBe('warning');
    expect(highErrorRateAlert.value).toBeGreaterThan(10); // 10% threshold
  });
  
  test('should trigger high response time alert', async () => {
    // Simulate slow responses
    jest.spyOn(DatabaseService, 'query').mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 2000))
    );
    
    await request(app).get('/api/users').expect(200);
    
    // Wait for metrics collection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const alerts = await getActiveAlerts();
    const slowResponseAlert = alerts.find(alert => alert.type === 'high_response_time');
    
    expect(slowResponseAlert).toBeDefined();
    expect(slowResponseAlert.severity).toBe('warning');
    
    // Restore normal behavior
    jest.restoreAllMocks();
  });
  
  test('should send notifications for critical alerts', async () => {
    // Trigger critical alert
    await triggerCriticalAlert('database_connection_failed');
    
    // Wait for notification processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const notifications = await getSentNotifications();
    const criticalNotification = notifications.find(n => 
      n.type === 'critical_alert' && n.alert_type === 'database_connection_failed'
    );
    
    expect(criticalNotification).toBeDefined();
    expect(criticalNotification.sent_at).toBeDefined();
    expect(criticalNotification.recipients).toContain('admin@example.com');
  });
});
```

### 2. Log Aggregation Testing
```javascript
// tests/monitoring/logging.test.js
describe('Logging System', () => {
  test('should collect structured logs', async () => {
    // Generate various log entries
    await request(app).get('/health');
    await request(app).get('/api/nonexistent');
    await request(app).post('/api/auth/login').send({ email: 'test@example.com' });
    
    const logs = await getRecentLogs(10);
    
    expect(logs.length).toBeGreaterThan(0);
    
    logs.forEach(log => {
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('level');
      expect(log).toHaveProperty('message');
      expect(log).toHaveProperty('meta');
    });
    
    // Should have different log levels
    const levels = logs.map(log => log.level);
    expect(levels).toContain('info');
    expect(levels).toContain('error');
  });
  
  test('should correlate request logs', async () => {
    const requestId = 'test-request-123';
    
    const response = await request(app)
      .get('/health')
      .set('X-Request-ID', requestId);
    
    expect(response.status).toBe(200);
    
    const logs = await getLogsByRequestId(requestId);
    expect(logs.length).toBeGreaterThan(0);
    
    // All logs for this request should have the same request ID
    logs.forEach(log => {
      expect(log.meta.requestId).toBe(requestId);
    });
  });
  
  test('should rotate logs correctly', async () => {
    // Generate many logs to trigger rotation
    for (let i = 0; i < 1000; i++) {
      logger.info(`Test log entry ${i}`);
    }
    
    // Wait for rotation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const logFiles = await getLogFiles();
    expect(logFiles.length).toBeGreaterThan(1);
    
    // Check that old logs are archived
    const archivedFiles = logFiles.filter(file => file.includes('.gz'));
    expect(archivedFiles.length).toBeGreaterThan(0);
  });
});
```

## Test Execution Strategy

### 1. Test Environment Setup
```bash
# Install test dependencies
npm install --save-dev jest supertest @types/jest ts-jest

# Create test database
npm run db:create:test
npm run migrate:test

# Set up test environment
export NODE_ENV=test
export DATABASE_URL=postgresql://test:test@localhost:5432/test_db
```

### 2. Test Execution Commands
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:security": "jest --testPathPattern=tests/security",
    "test:performance": "jest --testPathPattern=tests/performance",
    "test:monitoring": "jest --testPathPattern=tests/monitoring",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

### 3. Test Coverage Requirements
- Unit tests: >90% coverage
- Integration tests: >80% coverage
- Security tests: 100% coverage of security-critical paths
- Performance tests: All performance benchmarks must pass

### 4. Continuous Integration
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Test Data Management

### 1. Test Data Factories
```javascript
// tests/factories/userFactory.js
const createTestUser = async (overrides = {}) => {
  const defaultData = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    name: 'Test User',
    email_verified: false,
    role: 'user'
  };
  
  const userData = { ...defaultData, ...overrides };
  
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
```

### 2. Database Cleanup
```javascript
// tests/helpers/database.js
const clearDatabase = async () => {
  const tables = ['users', 'email_verifications', 'user_sessions', 'audit_logs'];
  
  for (const table of tables) {
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
};
```

This comprehensive testing strategy ensures that all components of the production-ready application are thoroughly tested for functionality, security,