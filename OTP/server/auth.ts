import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET environment variables are required");
}

if (JWT_SECRET.length < 32 || JWT_REFRESH_SECRET.length < 32) {
  throw new Error("JWT secrets must be at least 32 characters long");
}

// Token generation functions
export function generateAccessToken(user: SelectUser): string {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      role: user.role 
    },
    JWT_SECRET!,
    { 
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'stackkflips-auth',
      audience: 'stackkflips-app'
    }
  );
}

export function generateRefreshToken(user: SelectUser): string {
  return jwt.sign(
    { 
      userId: user.id,
      tokenType: 'refresh'
    },
    JWT_REFRESH_SECRET!,
    { 
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'stackkflips-auth',
      audience: 'stackk-flips-app'
    }
  );
}

export function verifyAccessToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET!, {
      issuer: 'stackkflips-auth',
      audience: 'stackkflips-app'
    });
  } catch (error) {
    throw new Error('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): any {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'stackkflips-auth',
      audience: 'stackkflips-app'
    });
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}

// Zod validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email format").min(1, "Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 12);
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    return await bcrypt.compare(supplied, stored);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Validate required environment variables
  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  if (SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long");
  }
  
  const sessionSettings: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Only use secure cookies in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      sameSite: 'lax'
    }
  };
  
  console.log('Session store configured. Environment:', process.env.NODE_ENV);

  app.set("trust proxy", 1);
  
  // Add debugging middleware for sessions - only log cookie information
  app.use((req, res, next) => {
    const sessionId = req.headers.cookie?.match(/(?:^|;\s*)connect\.sid=([^;]*)/)?.[1];
    console.log(`Request path: ${req.path}, Session ID from cookie: ${sessionId || 'none'}`);
    next();
  });
  
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Add session debugging middleware - now safe to use isAuthenticated after passport is initialized
  app.use((req, res, next) => {
    try {
      // Create a safe version of the session info with explicit typing
      const sessionInfo: {
        sessionID: string;
        hasSession: boolean;
        user: { id: number; username: string } | null;
        authenticated: boolean;
      } = {
        sessionID: req.sessionID || 'no-session-id',
        hasSession: !!req.session,
        user: req.user ? { id: req.user.id, username: req.user.username } : null,
        authenticated: false
      };
      
      // Only check authentication if the function exists
      if (typeof req.isAuthenticated === 'function') {
        try {
          sessionInfo.authenticated = req.isAuthenticated();
        } catch (error) {
          console.error("Error calling isAuthenticated:", error);
        }
      } else {
        console.log("Warning: req.isAuthenticated is not a function");
      }
      
      console.log(`Session info: ${JSON.stringify(sessionInfo)}`);
    } catch (error) {
      console.error("Error in session debugging middleware:", error);
    }
    
    // Always continue even if there was an error in the logging code
    next();
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Try to find the user
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          console.log(`User not found: ${username}`);
          return done(null, false, { message: "User not found" });
        }
        
        // Regular password check
        const isValid = await comparePasswords(password, user.passwordHash);
        if (!isValid) {
          console.log(`Invalid password for user: ${username}`);
          return done(null, false, { message: "Invalid password" });
        }
        
        // Authentication successful
        return done(null, user);
      } catch (error) {
        console.error("Authentication error:", error);
        return done(error as Error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    const userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;
    console.log(`Serializing user: ${userName} (ID: ${user.id})`);
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      
      if (!user) {
        console.log(`User not found for ID: ${id} during deserialization`);
        return done(null, false);
      }
      
      const userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;
      console.log(`Deserialized user: ${userName} (ID: ${id})`);
      done(null, user);
    } catch (error) {
      console.error("Error during user deserialization:", error);
      done(error as Error, null);
    }
  });

  app.post("/api/register", async (req: Request, res, next) => {
    try {
      // Validate input with Zod
      const validationResult = registerSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      const { email, password, ...additionalData } = validationResult.data;
      
      // Check for existing user by email
      try {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "Email already exists" });
        }
      } catch (lookupError) {
        console.error("Error checking existing user:", lookupError);
        return res.status(500).json({ message: "Error checking email availability" });
      }

      // Create user with hashed password
      let user;
      try {
        const hashedPassword = await hashPassword(password);
        user = await storage.createUser({
          email,
          passwordHash: hashedPassword,
          ...additionalData,
        });
      } catch (createError) {
        console.error("Error creating user:", createError);
        return res.status(500).json({ message: "Failed to create user account" });
      }

      // Check if req.login exists
      if (typeof req.login !== 'function') {
        console.error("req.login is not a function");
        return res.status(500).json({ message: "Session system error" });
      }

      // Login the newly created user
      req.login(user, (err) => {
        if (err) {
          console.error("Session error during registration:", err);
          return res.status(500).json({ message: "User created but failed to login" });
        }
        
        // Return user data without sensitive information
        const { passwordHash, ...userResponse } = user as any;
        res.status(201).json(userResponse);
      });
    } catch (error) {
      console.error("Error in /api/register route:", error);
      res.status(500).json({ message: "Server error during registration" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    try {
      // Validate input with Zod
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      const { username, password } = validationResult.data;
      console.log("Login attempt for username:", username);
      
      // Ensure we have passport and its authenticate method
      if (!passport || typeof passport.authenticate !== 'function') {
        console.error("Passport not properly initialized");
        return res.status(500).json({ message: "Authentication system error" });
      }
      
      passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: any) => {
        try {
          if (err) {
            console.error("Authentication error:", err);
            return res.status(500).json({ message: "Authentication error occurred" });
          }
          
          if (!user) {
            console.error("Authentication failed:", info);
            return res.status(401).json({ message: "Invalid username or password" });
          }
          
          // Check if req.login exists
          if (typeof req.login !== 'function') {
            console.error("req.login is not a function");
            return res.status(500).json({ message: "Session system error" });
          }
          
          req.login(user, (err: Error | null) => {
            if (err) {
              console.error("Session error:", err);
              return res.status(500).json({ message: "Failed to create session" });
            }
            
            console.log("User authenticated successfully:", user.email);
            // Safely log session data without type errors
            console.log("Session data:", {
              id: req.sessionID,
              cookie: req.session?.cookie,
              // Access session data safely
              data: req.session ? JSON.stringify(req.session) : 'No session'
            });
            
            // Generate JWT tokens
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
            
            // Return the user data without sensitive information
            const { passwordHash, ...userResponse } = user as any;
            
            res.status(200).json({
              ...userResponse,
              accessToken,
              refreshToken,
              tokenType: 'Bearer'
            });
          });
        } catch (innerError) {
          console.error("Error in passport authenticate callback:", innerError);
          return res.status(500).json({ message: "Server error during authentication" });
        }
      })(req, res, next);
    } catch (outerError) {
      console.error("Error in /api/login route:", outerError);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    try {
      // Check if req.logout exists
      if (typeof req.logout !== 'function') {
        console.error("req.logout is not a function");
        return res.status(500).json({ message: "Session system error" });
      }
      
      req.logout((err) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        
        // Successfully logged out
        console.log("User logged out successfully");
        res.sendStatus(200);
      });
    } catch (error) {
      console.error("Error in /api/logout route:", error);
      res.status(500).json({ message: "Server error during logout" });
    }
  });

  app.post("/api/refresh-token", async (req: Request, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is required" });
      }
      
      // Verify refresh token
      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch (error) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      
      // Get user from database
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Generate new access token
      const accessToken = generateAccessToken(user);
      
      res.status(200).json({
        accessToken,
        tokenType: 'Bearer'
      });
    } catch (error) {
      console.error("Error in /api/refresh-token route:", error);
      res.status(500).json({ message: "Server error during token refresh" });
    }
  });

  app.get("/api/user", (req, res) => {
    try {
      // Create a safe version of the session info
      const sessionInfo = {
        sessionID: req.sessionID || 'no-session-id',
        hasSession: !!req.session,
        user: req.user ? { id: req.user.id, email: req.user.email } : null,
        authenticated: false
      };
      
      // Safety check for authenticated function
      if (typeof req.isAuthenticated === 'function') {
        try {
          // Safely try to call isAuthenticated
          sessionInfo.authenticated = req.isAuthenticated();
        } catch (authError) {
          console.error("Error calling isAuthenticated:", authError);
          return res.status(500).json({ message: "Authentication system error" });
        }
      } else {
        console.error("req.isAuthenticated is not a function in /api/user route");
        return res.status(500).json({ message: "Authentication system error" });
      }
      
      console.log("Session info at /api/user:", sessionInfo);
      
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Return user data without the password
      const { passwordHash, ...userWithoutPassword } = req.user as any;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error in /api/user route:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
}
