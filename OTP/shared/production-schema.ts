import { pgTable, text, serial, integer, timestamp, boolean, numeric, date, uuid, pgEnum, inet, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for production schema
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "super_admin"]);
export const tokenTypeEnum = pgEnum("token_type", ["email_verification", "password_reset", "api_key"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "converted", "lost"]);
export const callOutcomeEnum = pgEnum("call_outcome", ["answered", "voicemail", "busy", "no_answer", "failed"]);
export const scheduledCallStatusEnum = pgEnum("scheduled_call_status", ["scheduled", "completed", "cancelled", "missed"]);
export const activityTypeEnum = pgEnum("activity_type", ["call", "email", "meeting", "note", "status_change", "task"]);
export const teamMemberRoleEnum = pgEnum("team_member_role", ["leader", "member", "viewer"]);
export const metricTypeEnum = pgEnum("metric_type", ["cpu", "memory", "disk", "response_time", "error_rate", "uptime"]);
export const healthStatusEnum = pgEnum("health_status", ["healthy", "warning", "critical"]);
export const logSeverityEnum = pgEnum("log_severity", ["debug", "info", "warning", "error", "critical"]);

// Enhanced Users table with production features
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  role: userRoleEnum("role").default("user"),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
  resetToken: text("reset_token"),
  resetExpiresAt: timestamp("reset_expires_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  loginAttempts: integer("login_attempts").default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  calls: many(calls),
  scheduledCalls: many(scheduledCalls),
  activities: many(activities),
  timesheets: many(timesheets),
  teamMembers: many(teamMembers),
  verificationTokens: many(verificationTokens),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  errorLogs: many(errorLogs),
}));

export const insertUserSchema = createInsertSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Verification tokens table
export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  type: tokenTypeEnum("type").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [verificationTokens.userId],
    references: [users.id]
  })
}));

export const insertVerificationTokenSchema = createInsertSchema(verificationTokens);
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type InsertVerificationToken = z.infer<typeof insertVerificationTokenSchema>;

// API keys table
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  name: text("name").notNull(),
  permissions: jsonb("permissions").default("[]"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id]
  })
}));

export const insertApiKeySchema = createInsertSchema(apiKeys);
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// Health metrics table
export const healthMetrics = pgTable("health_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceName: text("service_name").notNull(),
  metricType: metricTypeEnum("metric_type").notNull(),
  metricValue: numeric("metric_value", { precision: 10, scale: 2 }).notNull(),
  thresholdWarning: numeric("threshold_warning", { precision: 10, scale: 2 }),
  thresholdCritical: numeric("threshold_critical", { precision: 10, scale: 2 }),
  status: healthStatusEnum("status").default("healthy"),
  metadata: jsonb("metadata").default("{}"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertHealthMetricSchema = createInsertSchema(healthMetrics);
export type HealthMetric = typeof healthMetrics.$inferSelect;
export type InsertHealthMetric = z.infer<typeof insertHealthMetricSchema>;

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs);
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Rate limit tracking table
export const rateLimitTracking = pgTable("rate_limit_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(), // IP address or user ID
  endpoint: text("endpoint").notNull(),
  requestCount: integer("request_count").default(1),
  windowStart: timestamp("window_start", { withTimezone: true }).defaultNow().notNull(),
  windowDuration: text("window_duration").default("1 hour"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRateLimitTrackingSchema = createInsertSchema(rateLimitTracking);
export type RateLimitTracking = typeof rateLimitTracking.$inferSelect;
export type InsertRateLimitTracking = z.infer<typeof insertRateLimitTrackingSchema>;

// Error logs table
export const errorLogs = pgTable("error_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  errorCode: text("error_code"),
  errorMessage: text("error_message").notNull(),
  errorStack: text("error_stack"),
  severity: logSeverityEnum("severity").default("error"),
  context: jsonb("context").default("{}"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const errorLogsRelations = relations(errorLogs, ({ one }) => ({
  user: one(users, {
    fields: [errorLogs.userId],
    references: [users.id]
  })
}));

export const insertErrorLogSchema = createInsertSchema(errorLogs);
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;

// System configuration table
export const systemConfig = pgTable("system_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  isSecret: boolean("is_secret").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig);
export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;

// Enhanced Leads table
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  status: leadStatusEnum("status").default("new"),
  source: text("source"),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const leadsRelations = relations(leads, ({ one, many }) => ({
  user: one(users, {
    fields: [leads.userId],
    references: [users.id]
  }),
  assignedUser: one(users, {
    fields: [leads.assignedTo],
    references: [users.id]
  }),
  calls: many(calls),
  scheduledCalls: many(scheduledCalls),
  activities: many(activities),
}));

export const insertLeadSchema = createInsertSchema(leads);
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

// Enhanced Calls table
export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  duration: integer("duration"), // in seconds
  recordingUrl: text("recording_url"),
  notes: text("notes"),
  outcome: callOutcomeEnum("outcome"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const callsRelations = relations(calls, ({ one }) => ({
  user: one(users, {
    fields: [calls.userId],
    references: [users.id]
  }),
  lead: one(leads, {
    fields: [calls.leadId],
    references: [leads.id]
  })
}));

export const insertCallSchema = createInsertSchema(calls);
export type Call = typeof calls.$inferSelect;
export type InsertCall = z.infer<typeof insertCallSchema>;

// Enhanced Scheduled calls table
export const scheduledCalls = pgTable("scheduled_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  duration: integer("duration").default(30),
  notes: text("notes"),
  status: scheduledCallStatusEnum("status").default("scheduled"),
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scheduledCallsRelations = relations(scheduledCalls, ({ one }) => ({
  user: one(users, {
    fields: [scheduledCalls.userId],
    references: [users.id]
  }),
  lead: one(leads, {
    fields: [scheduledCalls.leadId],
    references: [leads.id]
  })
}));

export const insertScheduledCallSchema = createInsertSchema(scheduledCalls);
export type ScheduledCall = typeof scheduledCalls.$inferSelect;
export type InsertScheduledCall = z.infer<typeof insertScheduledCallSchema>;

// Enhanced Team members table
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamName: text("team_name").notNull(),
  role: teamMemberRoleEnum("role").default("member"),
  permissions: jsonb("permissions").default("[]"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id]
  })
}));

export const insertTeamMemberSchema = createInsertSchema(teamMembers);
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

// Enhanced Activities table
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  type: activityTypeEnum("type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id]
  }),
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id]
  })
}));

export const insertActivitySchema = createInsertSchema(activities);
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// Enhanced Timesheets table
export const timesheets = pgTable("timesheets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskDescription: text("task_description").notNull(),
  hoursWorked: numeric("hours_worked", { precision: 4, scale: 2 }).notNull(),
  dateWorked: date("date_worked").notNull(),
  project: text("project"),
  billable: boolean("billable").default(true),
  approved: boolean("approved").default(false),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const timesheetsRelations = relations(timesheets, ({ one }) => ({
  user: one(users, {
    fields: [timesheets.userId],
    references: [users.id]
  }),
  approver: one(users, {
    fields: [timesheets.approvedBy],
    references: [users.id]
  })
}));

export const insertTimesheetSchema = createInsertSchema(timesheets);
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;

// Legacy compatibility exports (for existing code)
export { users as legacyUsers, leads as legacyLeads, calls as legacyCalls, scheduledCalls as legacyScheduledCalls, teamMembers as legacyTeamMembers, activities as legacyActivities, timesheets as legacyTimesheets } from "./schema";