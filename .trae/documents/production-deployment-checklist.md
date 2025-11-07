# Production Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Set up production environment variables
- [ ] Configure database connection strings
- [ ] Set up JWT secrets and encryption keys
- [ ] Configure email service API keys
- [ ] Set up monitoring service credentials
- [ ] Configure backup storage credentials

### 2. Security Setup
- [ ] Generate secure random secrets for all services
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up VPN access for admin functions
- [ ] Configure secure SSH access
- [ ] Set up intrusion detection system

## Implementation Steps

### Step 1: CORS Configuration for Vercel Deployment

#### 1.1 Configure CORS Policies
```javascript
// cors.config.js
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://your-app.vercel.app',
      'https://your-app-git-main-your-username.vercel.app',
      'https://your-app-*.vercel.app'
    ];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-CSRF-Token'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
};
```

#### 1.2 Implement Preflight Request Handling
```javascript
// middleware/cors.js
const cors = require('cors');

const configureCORS = (app) => {
  // Handle preflight requests
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-CSRF-Token');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
      return res.sendStatus(200);
    }
    next();
  });
  
  app.use(cors(corsOptions));
};
```

#### 1.3 Configure Vercel-Specific Headers
```javascript
// middleware/vercel-headers.js
const configureVercelHeaders = (req, res, next) => {
  // Vercel-specific security headers
  res.setHeader('X-Vercel-Id', process.env.VERCEL_ID || 'local');
  res.setHeader('X-Vercel-Region', process.env.VERCEL_REGION || 'local');
  
  // Cache control for static assets
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  next();
};
```

### Step 2: Email Verification System

#### 2.1 Create Email Templates with Branding
```html
<!-- templates/email-verification.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        .email-container { max-width: 600px; margin: 0 auto; font-family: 'Inter', sans-serif; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 40px; text-align: center; }
        .logo { color: white; font-size: 28px; font-weight: bold; }
        .content { padding: 40px; background: white; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 15px 30px; 
                 text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">YourApp</div>
        </div>
        <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Hi {{userName}},</p>
            <p>Thank you for signing up! Please click the button below to verify your email address:</p>
            <div style="text-align: center;">
                <a href="{{verificationUrl}}" class="button">Verify Email Address</a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #64748b;">{{verificationUrl}}</p>
            <p>This verification link will expire in 24 hours for security reasons.</p>
            <p>If you didn't create an account with us, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 YourApp. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
```

#### 2.2 Set Up Verification Token Generation
```javascript
// services/emailVerification.js
const crypto = require('crypto');
const { supabase } = require('../config/supabase');

class EmailVerificationService {
  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  static async createVerificationToken(userId, email) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const { data, error } = await supabase
      .from('email_verifications')
      .insert([{
        user_id: userId,
        token: token,
        expires_at: expiresAt.toISOString(),
        used: false
      }]);
    
    if (error) {
      throw new Error(`Failed to create verification token: ${error.message}`);
    }
    
    return { token, expiresAt };
  }
  
  static async verifyToken(token) {
    const { data, error } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) {
      return { valid: false, reason: 'Invalid or expired token' };
    }
    
    return { valid: true, verification: data };
  }
  
  static async markTokenAsUsed(token) {
    const { error } = await supabase
      .from('email_verifications')
      .update({ used: true })
      .eq('token', token);
    
    if (error) {
      throw new Error(`Failed to mark token as used: ${error.message}`);
    }
  }
}
```

#### 2.3 Build Verification Endpoint
```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();
const EmailVerificationService = require('../services/emailVerification');
const EmailService = require('../services/emailService');

router.post('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.body;
    
    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Token and email are required'
      });
    }
    
    // Verify the token
    const verification = await EmailVerificationService.verifyToken(token);
    
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.reason || 'Invalid verification token'
      });
    }
    
    // Update user email verification status
    const { error: userError } = await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', verification.verification.user_id);
    
    if (userError) {
      throw new Error(`Failed to update user: ${userError.message}`);
    }
    
    // Mark token as used
    await EmailVerificationService.markTokenAsUsed(token);
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      redirect_url: '/dashboard'
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during verification'
    });
  }
});
```

#### 2.4 Implement Resend Functionality
```javascript
// routes/auth.js
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Get user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }
    
    // Check if user has pending verification
    const { data: existingVerification } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (existingVerification) {
      // Check if enough time has passed (5 minutes cooldown)
      const timeSinceLastSent = Date.now() - new Date(existingVerification.created_at).getTime();
      if (timeSinceLastSent < 5 * 60 * 1000) {
        return res.status(429).json({
          success: false,
          message: 'Please wait 5 minutes before requesting another verification email'
        });
      }
    }
    
    // Create new verification token
    const { token } = await EmailVerificationService.createVerificationToken(user.id, email);
    
    // Send verification email
    await EmailService.sendVerificationEmail(email, user.name, token);
    
    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email'
    });
  }
});
```

### Step 3: Health Monitoring and Metrics

#### 3.1 Set Up Health Check Endpoint
```javascript
// routes/health.js
const express = require('express');
const router = express.Router();
const os = require('os');
const { supabase } = require('../config/supabase');

router.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    services: {}
  };
  
  try {
    // Check database connection
    const start = Date.now();
    const { error: dbError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    healthCheck.services.database = {
      status: dbError ? 'unhealthy' : 'healthy',
      responseTime: Date.now() - start
    };
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    healthCheck.services.memory = {
      status: memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9 ? 'warning' : 'healthy',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      systemMemory: {
        total: Math.round(totalMemory / 1024 / 1024) + 'MB',
        free: Math.round(freeMemory / 1024 / 1024) + 'MB',
        used: Math.round((totalMemory - freeMemory) / 1024 / 1024) + 'MB'
      }
    };
    
    // Check CPU usage
    const cpuUsage = process.cpuUsage();
    healthCheck.services.cpu = {
      status: 'healthy',
      user: Math.round(cpuUsage.user / 1000) + 'ms',
      system: Math.round(cpuUsage.system / 1000) + 'ms'
    };
    
    // Overall status
    const hasUnhealthyServices = Object.values(healthCheck.services)
      .some(service => service.status === 'unhealthy');
    
    if (hasUnhealthyServices) {
      healthCheck.status = 'unhealthy';
      res.status(503);
    } else {
      res.status(200);
    }
    
    res.json(healthCheck);
    
  } catch (error) {
    healthCheck.status = 'error';
    healthCheck.error = error.message;
    res.status(503).json(healthCheck);
  }
});
```

#### 3.2 Implement System Metrics Collection
```javascript
// services/metricsCollector.js
const { supabase } = require('../config/supabase');

class MetricsCollector {
  static async collectMetrics() {
    const metrics = [];
    const timestamp = new Date().toISOString();
    
    // CPU metrics
    const cpuUsage = process.cpuUsage();
    metrics.push({
      metric_type: 'cpu_user_ms',
      value: cpuUsage.user / 1000,
      tags: { type: 'process' },
      recorded_at: timestamp
    });
    
    // Memory metrics
    const memoryUsage = process.memoryUsage();
    metrics.push({
      metric_type: 'memory_heap_used_mb',
      value: memoryUsage.heapUsed / 1024 / 1024,
      tags: { type: 'heap' },
      recorded_at: timestamp
    });
    
    // Request metrics (from middleware)
    const requestStats = global.requestStats || { total: 0, errors: 0 };
    metrics.push({
      metric_type: 'requests_total',
      value: requestStats.total,
      tags: { status: 'all' },
      recorded_at: timestamp
    });
    
    metrics.push({
      metric_type: 'requests_errors',
      value: requestStats.errors,
      tags: { status: 'error' },
      recorded_at: timestamp
    });
    
    // Database connection metrics
    try {
      const start = Date.now();
      await supabase.from('users').select('id').limit(1);
      const responseTime = Date.now() - start;
      
      metrics.push({
        metric_type: 'database_response_time_ms',
        value: responseTime,
        tags: { query: 'health_check' },
        recorded_at: timestamp
      });
    } catch (error) {
      metrics.push({
        metric_type: 'database_errors',
        value: 1,
        tags: { error: error.message },
        recorded_at: timestamp
      });
    }
    
    // Store metrics in database
    const { error } = await supabase
      .from('system_metrics')
      .insert(metrics);
    
    if (error) {
      console.error('Failed to store metrics:', error);
    }
    
    return metrics;
  }
  
  static async getMetrics(timeRange = '1h') {
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const startTime = new Date(Date.now() - timeRanges[timeRange]);
    
    const { data, error } = await supabase
      .from('system_metrics')
      .select('*')
      .gte('recorded_at', startTime.toISOString())
      .order('recorded_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to retrieve metrics: ${error.message}`);
    }
    
    return data;
  }
}

module.exports = MetricsCollector;
```

#### 3.3 Configure Monitoring Dashboard
```javascript
// routes/monitoring.js
router.get('/metrics', async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    const metrics = await MetricsCollector.getMetrics(timeRange);
    
    // Process metrics for dashboard
    const processedMetrics = {
      summary: {
        totalRequests: 0,
        errorRate: 0,
        avgResponseTime: 0,
        uptime: process.uptime()
      },
      charts: {
        requestsOverTime: [],
        responseTimeOverTime: [],
        memoryUsageOverTime: [],
        cpuUsageOverTime: []
      }
    };
    
    // Aggregate metrics by type
    const metricsByType = {};
    metrics.forEach(metric => {
      if (!metricsByType[metric.metric_type]) {
        metricsByType[metric.metric_type] = [];
      }
      metricsByType[metric.metric_type].push(metric);
    });
    
    // Calculate summary statistics
    if (metricsByType['requests_total']) {
      processedMetrics.summary.totalRequests = metricsByType['requests_total'][0]?.value || 0;
    }
    
    if (metricsByType['requests_errors'] && metricsByType['requests_total']) {
      const errors = metricsByType['requests_errors'][0]?.value || 0;
      const total = metricsByType['requests_total'][0]?.value || 1;
      processedMetrics.summary.errorRate = (errors / total) * 100;
    }
    
    if (metricsByType['database_response_time_ms']) {
      const responseTimes = metricsByType['database_response_time_ms'].map(m => m.value);
      processedMetrics.summary.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
    
    res.json({
      success: true,
      data: processedMetrics,
      rawMetrics: metricsByType
    });
    
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve metrics'
    });
  }
});
```

#### 3.