import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import configuration and services
import config, { validateEnvironment } from './config/environment';
import { initializeServices, shutdownServices } from './services/initializer';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { 
  apiRateLimiter, 
  authRateLimiter, 
  emailRateLimiter, 
  adminRateLimiter 
} from './middleware/rateLimiter';

// Import routes
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import adminRoutes from './routes/admin.routes';

// Validate environment variables
validateEnvironment();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  },
});

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Apply security middleware
if (config.env === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.your-domain.com"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));
}

// Apply general middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply CORS middleware
app.use(corsMiddleware);

// Apply request logging
app.use(requestLogger);

// Apply rate limiting
app.use(apiRateLimiter);

// Health check endpoint (no rate limiting)
app.use('/api/health', healthRoutes);

// Apply rate limiting to specific routes
app.use('/api/auth', authRateLimiter);
app.use('/api/auth', authRoutes);

app.use('/api/admin', adminRateLimiter);
app.use('/api/admin', adminRoutes);

// Serve static files in production
if (config.isProduction) {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  
  if (path.resolve(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  }
} else {
  // Development proxy to Vite dev server
  app.get('*', (req, res) => {
    res.redirect(`http://localhost:3000${req.url}`);
  });
}

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Client connected:', socket.id);
  }

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Client disconnected:', socket.id);
    }
  });

  // Add more socket event handlers as needed
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n${signal} received, starting graceful shutdown...`);
  }
  
  try {
    // Stop accepting new connections
    server.close(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('HTTP server closed');
      }
    });
    
    // Close Socket.IO
    io.close(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Socket.IO server closed');
      }
    });
    
    // Shutdown services
    await shutdownServices();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Graceful shutdown completed');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize services and start server
const startServer = async () => {
  try {
    // Initialize all services
    await initializeServices();
    
    // Start server
    server.listen(config.port, config.host, () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🚀 Server running on http://${config.host}:${config.port}`);
        console.log(`📊 Environment: ${config.env}`);
        console.log(`🔒 CORS enabled for: ${config.cors.origin}`);
        console.log(`📧 Email verification: ${config.features.emailVerification ? 'enabled' : 'disabled'}`);
        console.log(`🛡️  Rate limiting: ${config.features.rateLimiting ? 'enabled' : 'disabled'}`);
        console.log(`📊 Health monitoring: ${config.features.healthMonitoring ? 'enabled' : 'disabled'}`);
        console.log(`🔍 Audit logging: ${config.features.auditLogging ? 'enabled' : 'disabled'}`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app, io };
