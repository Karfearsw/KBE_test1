-- Row Level Security Policies for Production Database
-- Secure access control for all tables

-- Users table policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can update user roles" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Verification tokens policies
CREATE POLICY "Users can view their own verification tokens" ON verification_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND users.id = verification_tokens.user_id
        )
    );

CREATE POLICY "Anonymous users can create verification tokens" ON verification_tokens
    FOR INSERT WITH CHECK (true);

-- API keys policies
CREATE POLICY "Users can manage their own API keys" ON api_keys
    FOR ALL USING (auth.uid() = user_id);

-- Health metrics policies
CREATE POLICY "Admins can view health metrics" ON health_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can create health metrics" ON health_metrics
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Audit logs policies
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Rate limit tracking policies
CREATE POLICY "Admins can view rate limit data" ON rate_limit_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Error logs policies
CREATE POLICY "Admins can view error logs" ON error_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- System config policies
CREATE POLICY "Admins can view system config" ON system_config
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Super admins can update system config" ON system_config
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Leads table policies
CREATE POLICY "Users can view their own leads" ON leads
    FOR SELECT USING (
        user_id = auth.uid() OR 
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Users can create leads" ON leads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" ON leads
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Users can delete their own leads" ON leads
    FOR DELETE USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Calls table policies
CREATE POLICY "Users can view calls for their leads" ON calls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = calls.lead_id 
            AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Users can create calls for their leads" ON calls
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = calls.lead_id 
            AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid())
        )
    );

-- Scheduled calls policies
CREATE POLICY "Users can view scheduled calls for their leads" ON scheduled_calls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = scheduled_calls.lead_id 
            AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Users can create scheduled calls for their leads" ON scheduled_calls
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = scheduled_calls.lead_id 
            AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid())
        )
    );

CREATE POLICY "Users can update scheduled calls for their leads" ON scheduled_calls
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = scheduled_calls.lead_id 
            AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid())
        )
    );

-- Team members policies
CREATE POLICY "Users can view team members" ON team_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can manage team members" ON team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Activities policies
CREATE POLICY "Users can view activities for their leads" ON activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = activities.lead_id 
            AND (leads.user_id = auth.uid() OR leads.assigned_to = auth.uid())
        ) OR
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Users can create activities" ON activities
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Timesheets policies
CREATE POLICY "Users can manage their own timesheets" ON timesheets
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all timesheets" ON timesheets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON users TO anon;
GRANT INSERT ON users TO anon;
GRANT UPDATE ON users TO authenticated;

GRANT SELECT ON verification_tokens TO anon, authenticated;
GRANT INSERT ON verification_tokens TO anon, authenticated;

GRANT ALL ON api_keys TO authenticated;

GRANT SELECT ON health_metrics TO authenticated;
GRANT INSERT ON health_metrics TO authenticated;

GRANT SELECT ON audit_logs TO authenticated;

GRANT SELECT ON rate_limit_tracking TO authenticated;

GRANT SELECT ON error_logs TO authenticated;

GRANT SELECT ON system_config TO authenticated;
GRANT UPDATE ON system_config TO authenticated;

GRANT ALL ON leads TO authenticated;

GRANT ALL ON calls TO authenticated;

GRANT ALL ON scheduled_calls TO authenticated;

GRANT ALL ON team_members TO authenticated;

GRANT ALL ON activities TO authenticated;

GRANT ALL ON timesheets TO authenticated;