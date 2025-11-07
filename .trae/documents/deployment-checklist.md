# Production Deployment Checklist

## Pre-Deployment Requirements

### 1. Environment Setup
- [ ] Set up production server (AWS EC2, DigitalOcean, or similar)
- [ ] Configure domain name and SSL certificates
- [ ] Set up PostgreSQL database with proper security
- [ ] Configure Redis instance for session management
- [ ] Set up load balancer if using multiple instances

### 2. Environment Variables
Create `.env.production` file with the following variables:

```bash
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://username:password@host:port/database
DB_SSL=true
DB_POOL_SIZE=20

# Redis
REDIS_URL=redis://username:password@host:port
REDIS_SSL=true

# JWT & Security
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
SESSION_SECRET=your-super-secure-session-secret
BCRYPT_ROUNDS=12

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=FlipStackk

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,doc,docx

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
APM_ENABLED=true

# Security
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### 3. Database Migration
- [ ] Run database migrations: `npm run db:push`
- [ ] Verify all tables are created correctly
- [ ] Set up database indexes and constraints
- [ ] Create database backup procedures
- [ ] Test database connection from application

### 4. Build Process
- [ ] Run TypeScript compilation: `npm run check`
- [ ] Build frontend assets: `npm run build`
- [ ] Verify build output in `dist/` directory
- [ ] Test production build locally
- [ ] Optimize bundle size and assets

### 5. Security Configuration
- [ ] Configure firewall rules (allow 80, 443, SSH only)
- [ ] Set up fail2ban for intrusion prevention
- [ ] Configure SSL/TLS certificates
- [ ] Set up security headers in Nginx/Apache
- [ ] Implement rate limiting
- [ ] Configure CORS policies

## Deployment Steps

### 1. Server Preparation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Create application user
sudo useradd -m -s /bin/bash flipstackk
sudo mkdir -p /app
sudo chown flipstackk:flipstackk /app
```

### 2. Application Deployment
```bash
# Switch to application user
sudo su - flipstackk

# Clone repository
git clone https://github.com/yourusername/flipstackk.git /app
cd /app

# Install dependencies
npm ci --only=production

# Copy environment file
cp .env.production .env

# Build application
npm run build

# Start with PM2
pm2 start dist/index.js --name flipstackk
pm2 startup
pm2 save
```

### 3. Nginx Configuration
Create `/etc/nginx/sites-available/flipstackk`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
    }
}
```

### 4. SSL Certificate Setup
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### 5. Database Setup
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database and user
sudo -u postgres psql
CREATE DATABASE flipstackk_production;
CREATE USER flipstackk_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE flipstackk_production TO flipstackk_user;
\q

# Configure PostgreSQL for remote access
sudo nano /etc/postgresql/14/main/postgresql.conf
# Add: listen_addresses = '*'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# Add: host all all 0.0.0.0/0 md5

sudo systemctl restart postgresql
```

### 6. Redis Setup
```bash
# Install Redis
sudo apt install redis-server -y

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: requirepass your-redis-password
# Set: bind 127.0.0.1 ::1

sudo systemctl restart redis-server
```

## Post-Deployment Verification

### 1. Application Testing
- [ ] Test all authentication flows (login, logout, password recovery)
- [ ] Verify lead CRUD operations work correctly
- [ ] Test file upload functionality
- [ ] Check email notifications are sent
- [ ] Verify all API endpoints respond correctly
- [ ] Test responsive design on mobile devices

### 2. Performance Testing
- [ ] Run load testing with Apache Bench or similar
- [ ] Check database query performance
- [ ] Verify caching is working correctly
- [ ] Test file upload/download speeds
- [ ] Monitor memory usage under load

### 3. Security Testing
- [ ] Run security scan with OWASP ZAP
- [ ] Test for SQL injection vulnerabilities
- [ ] Verify XSS protection is working
- [ ] Check for CSRF protection on forms
- [ ] Test rate limiting functionality
- [ ] Verify SSL certificate is properly configured

### 4. Monitoring Setup
- [ ] Set up application logs monitoring
- [ ] Configure error alerting (Sentry/Email)
- [ ] Set up database performance monitoring
- [ ] Configure server resource monitoring
- [ ] Set up uptime monitoring

## Maintenance Procedures

### Daily Tasks
- [ ] Check application logs for errors
- [ ] Monitor server resource usage
- [ ] Verify database backups completed
- [ ] Check SSL certificate expiration dates

### Weekly Tasks
- [ ] Review security logs for suspicious activity
- [ ] Update system packages
- [ ] Check disk space usage
- [ ] Review performance metrics

### Monthly Tasks
- [ ] Test backup restoration procedures
- [ ] Review and update dependencies
- [ ] Conduct security audit
- [ ] Performance optimization review

## Rollback Procedures

### Application Rollback
```bash
# Stop current version
pm2 stop flipstackk

# Restore previous version
git checkout previous-commit-hash
npm ci --only=production
npm run build

# Restart application
pm2 start dist/index.js --name flipstackk

# Verify rollback
pm2 logs flipstackk
```

### Database Rollback
```bash
# Restore from backup
pg_restore -d flipstackk_production backup_file.sql

# Verify data integrity
psql -d flipstackk_production -c "SELECT COUNT(*) FROM users;"
```

## Emergency Contacts

- **Technical Lead**: [Name] - [Email] - [Phone]
- **DevOps Engineer**: [Name] - [Email] - [Phone]
- **Database Admin**: [Name] - [Email] - [Phone]
- **Security Team**: [Name] - [Email] - [Phone]

## Documentation Links

- [Application Architecture](./technical-architecture-document.md)
- [API Documentation](./api-documentation.md)
- [User Manual](./user-manual.md)
- [Troubleshooting Guide](./troubleshooting-guide.md)