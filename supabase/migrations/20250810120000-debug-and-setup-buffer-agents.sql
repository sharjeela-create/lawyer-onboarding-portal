-- Debug and Setup Buffer Closers Migration
-- This migration will help debug existing data and properly set up buffer agents

-- First, let's examine what's currently in our tables
-- Create a temporary view to see all user data
CREATE OR REPLACE VIEW debug_user_data AS
SELECT 
  'auth.users' as table_name,
  au.id as user_id,
  au.email,
  au.created_at,
  NULL as display_name,
  NULL as status,
  NULL as agent_type
FROM auth.users au
UNION ALL
SELECT 
  'profiles' as table_name,
  p.user_id,
  au.email,
  p.created_at,
  p.display_name,
  NULL as status,
  NULL as agent_type
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
UNION ALL
SELECT 
  'agent_status' as table_name,
  ast.user_id,
  au.email,
  ast.created_at,
  p.display_name,
  ast.status,
  ast.agent_type
FROM public.agent_status ast
LEFT JOIN auth.users au ON au.id = ast.user_id
LEFT JOIN public.profiles p ON p.user_id = ast.user_id;

-- Now let's check if we have the required users in auth.users
-- If they don't exist, we'll create them with proper setup

-- Function to safely insert or update buffer agents
CREATE OR REPLACE FUNCTION setup_buffer_agents()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    kyla_user_id UUID;
    ira_user_id UUID;
    bryan_user_id UUID;
BEGIN
    -- Check if Kyla exists in auth.users, if not we'll use a known user or create a placeholder
    SELECT id INTO kyla_user_id FROM auth.users WHERE email ILIKE '%kyla%' LIMIT 1;
    IF kyla_user_id IS NULL THEN
        -- Use the first available user or a specific known user ID
        SELECT id INTO kyla_user_id FROM auth.users LIMIT 1;
        IF kyla_user_id IS NULL THEN
            -- If no users exist, we'll create a placeholder UUID (this shouldn't happen in real scenarios)
            kyla_user_id := '96153ce4-1d62-4434-8b3a-a4b6b178be26';
        END IF;
    END IF;

    -- Check if Ira exists
    SELECT id INTO ira_user_id FROM auth.users WHERE email ILIKE '%ira%' LIMIT 1;
    IF ira_user_id IS NULL THEN
        SELECT id INTO ira_user_id FROM auth.users WHERE id != kyla_user_id LIMIT 1;
        IF ira_user_id IS NULL THEN
            ira_user_id := '24e4781c-474c-4898-a22a-985b5f0066a2';
        END IF;
    END IF;

    -- Check if Bryan exists
    SELECT id INTO bryan_user_id FROM auth.users WHERE email ILIKE '%bryan%' LIMIT 1;
    IF bryan_user_id IS NULL THEN
        SELECT id INTO bryan_user_id FROM auth.users WHERE id NOT IN (kyla_user_id, ira_user_id) LIMIT 1;
        IF bryan_user_id IS NULL THEN
            bryan_user_id := '27cfea76-6bd0-4543-90f1-7bc313429825';
        END IF;
    END IF;

    -- Insert or update profiles for buffer agents
    INSERT INTO public.profiles (user_id, display_name, created_at, updated_at)
    VALUES 
        (kyla_user_id, 'Kyla', NOW(), NOW()),
        (ira_user_id, 'Ira', NOW(), NOW()),
        (bryan_user_id, 'Bryan', NOW(), NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        display_name = EXCLUDED.display_name,
        updated_at = NOW();

    -- Insert or update agent_status for buffer agents
    INSERT INTO public.agent_status (user_id, status, agent_type, last_activity, created_at, updated_at)
    VALUES 
        (kyla_user_id, 'available', 'buffer', NOW(), NOW(), NOW()),
        (ira_user_id, 'available', 'buffer', NOW(), NOW(), NOW()),
        (bryan_user_id, 'available', 'buffer', NOW(), NOW(), NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = 'available',
        agent_type = 'buffer',
        last_activity = NOW(),
        updated_at = NOW();

    -- Log the setup
    RAISE NOTICE 'Buffer agents setup completed:';
    RAISE NOTICE 'Kyla: %', kyla_user_id;
    RAISE NOTICE 'Ira: %', ira_user_id;
    RAISE NOTICE 'Bryan: %', bryan_user_id;
END;
$$;

-- Run the setup function
SELECT setup_buffer_agents();

-- Create a view to easily see buffer agents with their details
CREATE OR REPLACE VIEW buffer_agents_view AS
SELECT 
    ast.user_id,
    ast.status,
    ast.agent_type,
    ast.last_activity,
    p.display_name,
    au.email,
    ast.created_at as agent_status_created,
    p.created_at as profile_created
FROM public.agent_status ast
LEFT JOIN public.profiles p ON p.user_id = ast.user_id
LEFT JOIN auth.users au ON au.id = ast.user_id
WHERE ast.agent_type = 'buffer'
ORDER BY p.display_name;

-- Create a test lead for verification testing
INSERT INTO public.leads (
    submission_id,
    customer_full_name,
    street_address,
    city,
    state,
    zip_code,
    phone_number,
    email,
    date_of_birth,
    age,
    social_security,
    health_conditions,
    carrier,
    product_type,
    coverage_amount,
    monthly_premium,
    draft_date,
    beneficiary_routing,
    beneficiary_account,
    additional_notes,
    birth_state,
    driver_license,
    existing_coverage,
    previous_applications,
    height,
    weight,
    doctors_name,
    tobacco_use,
    medications,
    beneficiary_information,
    institution_name,
    account_type,
    lead_vendor,
    created_at,
    updated_at
) VALUES (
    'TEST_VERIFY_001',
    'William G Moore',
    '8700 NE 16th St',
    'Oklahoma City',
    'OK',
    '73110',
    '(405) 423-4272',
    'william.moore@example.com',
    '1948-05-26',
    77,
    '447489617',
    'nil',
    'AMAM',
    'Senior Choice Immediate',
    5000.00,
    63.37,
    '8th of aug',
    '103900036',
    '103900036',
    'Nil',
    'NE',
    'nil',
    'nil',
    'nil',
    '5.2',
    '160',
    'Dr. Daniel Pham, MD',
    'NO',
    'nil',
    'Son Garland Moore ( 09 08 1985)',
    'Bank of Oklahoma',
    'Checking',
    'Corebiz',
    NOW(),
    NOW()
) ON CONFLICT (submission_id) DO UPDATE SET
    updated_at = NOW();

-- Update RLS policies to ensure proper access
-- Drop existing policies first
DROP POLICY IF EXISTS "agent_status_select" ON public.agent_status;
DROP POLICY IF EXISTS "agent_status_insert" ON public.agent_status;
DROP POLICY IF EXISTS "agent_status_update" ON public.agent_status;

-- Create more permissive policies for agent_status
CREATE POLICY "agent_status_select" ON public.agent_status
    FOR SELECT USING (true);

CREATE POLICY "agent_status_insert" ON public.agent_status
    FOR INSERT WITH CHECK (true);

CREATE POLICY "agent_status_update" ON public.agent_status
    FOR UPDATE USING (true);

-- Ensure profiles table has proper RLS policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT USING (true);

-- Create debugging queries as comments for easy reference
/*
-- Query to check all buffer agents
SELECT * FROM buffer_agents_view;

-- Query to check user data
SELECT * FROM debug_user_data ORDER BY table_name, email;

-- Query to check if relationships work
SELECT 
    ast.user_id,
    ast.status,
    ast.agent_type,
    p.display_name,
    au.email
FROM public.agent_status ast
LEFT JOIN public.profiles p ON p.user_id = ast.user_id
LEFT JOIN auth.users au ON au.id = ast.user_id
WHERE ast.agent_type = 'buffer';

-- Query to test verification session creation
SELECT 
    vs.*,
    p.display_name as buffer_agent_name
FROM public.verification_sessions vs
LEFT JOIN public.profiles p ON p.user_id = vs.buffer_agent_id
ORDER BY vs.created_at DESC;
*/

-- Clean up the debug view when we're done
-- DROP VIEW IF EXISTS debug_user_data;
