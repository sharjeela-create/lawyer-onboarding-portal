-- Fix RLS policies for agent_status table
-- This migration addresses the 403 Forbidden errors

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "agent_status_select" ON public.agent_status;
DROP POLICY IF EXISTS "agent_status_insert" ON public.agent_status;
DROP POLICY IF EXISTS "agent_status_update" ON public.agent_status;
DROP POLICY IF EXISTS "agent_status_delete" ON public.agent_status;

-- Create more permissive policies for the verification system
-- Users can view all agent statuses (needed for agent selection)
CREATE POLICY "agent_status_select_all" ON public.agent_status
    FOR SELECT USING (true);

-- Authenticated users can insert their own agent status
CREATE POLICY "agent_status_insert_own" ON public.agent_status
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Authenticated users can update their own status, and system can update any
CREATE POLICY "agent_status_update_own_or_system" ON public.agent_status
    FOR UPDATE USING (
        auth.uid() = user_id 
        OR auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.agent_status 
            WHERE user_id = auth.uid() 
            AND agent_type IN ('licensed', 'admin')
        )
    );

-- Only admins can delete agent status records
CREATE POLICY "agent_status_delete_admin" ON public.agent_status
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.agent_status 
            WHERE user_id = auth.uid() 
            AND agent_type = 'admin'
        )
    );

-- Also ensure profiles table has proper policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

-- Everyone can view profiles (needed for agent names)
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT USING (true);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Fix verification_sessions policies
DROP POLICY IF EXISTS "verification_sessions_select" ON public.verification_sessions;
DROP POLICY IF EXISTS "verification_sessions_insert" ON public.verification_sessions;
DROP POLICY IF EXISTS "verification_sessions_update" ON public.verification_sessions;

-- All authenticated users can view verification sessions
CREATE POLICY "verification_sessions_select_all" ON public.verification_sessions
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Licensed agents can create verification sessions
CREATE POLICY "verification_sessions_insert_licensed" ON public.verification_sessions
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            auth.role() = 'service_role'
            OR EXISTS (
                SELECT 1 FROM public.agent_status 
                WHERE user_id = auth.uid() 
                AND agent_type IN ('licensed', 'admin')
            )
        )
    );

-- Buffer and licensed agents can update sessions they're involved in
CREATE POLICY "verification_sessions_update_involved" ON public.verification_sessions
    FOR UPDATE USING (
        auth.uid() IS NOT NULL
        AND (
            auth.role() = 'service_role'
            OR auth.uid() = buffer_agent_id
            OR auth.uid() = licensed_agent_id
            OR EXISTS (
                SELECT 1 FROM public.agent_status 
                WHERE user_id = auth.uid() 
                AND agent_type = 'admin'
            )
        )
    );

-- Fix verification_items policies  
DROP POLICY IF EXISTS "verification_items_select" ON public.verification_items;
DROP POLICY IF EXISTS "verification_items_insert" ON public.verification_items;
DROP POLICY IF EXISTS "verification_items_update" ON public.verification_items;

-- All authenticated users can view verification items
CREATE POLICY "verification_items_select_all" ON public.verification_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- System and agents involved in the session can insert items
CREATE POLICY "verification_items_insert_session_agents" ON public.verification_items
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            auth.role() = 'service_role'
            OR EXISTS (
                SELECT 1 FROM public.verification_sessions vs
                WHERE vs.id = session_id
                AND (vs.buffer_agent_id = auth.uid() OR vs.licensed_agent_id = auth.uid())
            )
        )
    );

-- Closers involved in the session can update items
CREATE POLICY "verification_items_update_session_agents" ON public.verification_items
    FOR UPDATE USING (
        auth.uid() IS NOT NULL
        AND (
            auth.role() = 'service_role'
            OR EXISTS (
                SELECT 1 FROM public.verification_sessions vs
                WHERE vs.id = session_id
                AND (vs.buffer_agent_id = auth.uid() OR vs.licensed_agent_id = auth.uid())
            )
        )
    );
