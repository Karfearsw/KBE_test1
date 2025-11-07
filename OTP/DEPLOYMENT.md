# Production Deployment Guide

## Prerequisites
- Node.js 18+ 
- PostgreSQL Database
- Redis (optional, for rate limiting)
- SMTP Email Service
- Vercel Account

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Core Settings
NODE_ENV=production
PORT=3000
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://user:password@localhost:5432/otp_production

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourapp.com

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Security
CORS_ORIGIN=https://yourapp.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Admin Setup
ADMIN_EMAIL=admin@yourapp.com
ADMIN_PASSWORD=secure-admin-password
```

## Database Setup

1. Create production database:
```sql
CREATE DATABASE otp_production;
```

2. Run migrations:
```bash
npm run db:push
```

3. Set up admin user (automatic on first startup if ADMIN_EMAIL is set)

## Build and Deploy

### Local Production Build
```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start production server
npm start
```

### Vercel Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy to Vercel:
```bash
vercel --prod
```

3. Set environment variables in Vercel dashboard

## Post-Deployment Verification

### Health Check
```bash
curl https://yourapp.vercel.app/api/health
```

### API Documentation
- Health: `GET /api/health`
- Auth: `POST /api/auth/register`, `POST /api/auth/login`
- Admin: `GET /api/admin/dashboard` (requires admin role)

### Monitoring
- Check logs in Vercel dashboard
- Monitor health metrics at `/api/health/detailed`
- Review audit logs at `/api/admin/audit-logs`

## Security Checklist

- [ ] JWT secret is strong and unique
- [ ] Database credentials are secure
- [ ] Email service is configured
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] Admin credentials are set
- [ ] SSL/TLS is enabled
- [ ] Error tracking is configured

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify DATABASE_URL format
   - Check network connectivity
   - Ensure database exists

2. **Email Not Sending**
   - Verify SMTP credentials
   - Check firewall settings
   - Review email service logs

3. **Rate Limiting Issues**
   - Check Redis connection
   - Verify rate limit configuration
   - Monitor request patterns

4. **CORS Errors**
   - Verify CORS_ORIGIN matches your domain
   - Check preflight request handling
   - Review browser console for errors

### Support

For issues, check:
- Application logs
- Vercel function logs
- Database logs
- Email service logs

## Performance Optimization

1. **Database**
   - Enable connection pooling
   - Add appropriate indexes
   - Monitor query performance

2. **Caching**
   - Configure Redis for rate limiting
   - Implement response caching where appropriate

3. **Monitoring**
   - Set up health check alerts
   - Monitor error rates
   - Track response times