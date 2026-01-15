-- =====================================================
-- AGENT LICENSING SYSTEM
-- =====================================================
-- This migration creates a comprehensive agent licensing system
-- to track which carriers and states each agent is licensed to work with.
-- 
-- Use Cases:
-- 1. Automatically assign leads to agents based on carrier and state
-- 2. Filter available agents for a specific lead requirement
-- 3. Manage agent licensing data centrally
-- =====================================================

-- =====================================================
-- 1. CARRIERS MASTER TABLE
-- =====================================================
-- Stores all available insurance carriers in the system

CREATE TABLE IF NOT EXISTS public.carriers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_name TEXT NOT NULL UNIQUE,
  carrier_code TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.carriers IS 'Master list of all insurance carriers available in the system';
COMMENT ON COLUMN public.carriers.carrier_name IS 'Full name of the insurance carrier';
COMMENT ON COLUMN public.carriers.carrier_code IS 'Short code or abbreviation for the carrier';
COMMENT ON COLUMN public.carriers.is_active IS 'Whether this carrier is currently active for new business';
COMMENT ON COLUMN public.carriers.display_order IS 'Order for displaying carriers in dropdowns';

-- Enable RLS
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carriers (viewable by all authenticated users, manageable by admins)
CREATE POLICY "Anyone can view active carriers" 
ON public.carriers 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert carriers" 
ON public.carriers 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

CREATE POLICY "Admins can update carriers" 
ON public.carriers 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

-- =====================================================
-- 2. STATES MASTER TABLE
-- =====================================================
-- Stores all US states and territories

CREATE TABLE IF NOT EXISTS public.states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_name TEXT NOT NULL UNIQUE,
  state_code TEXT NOT NULL UNIQUE, -- e.g., "AL", "AK", "AZ"
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.states IS 'Master list of all US states and territories';
COMMENT ON COLUMN public.states.state_name IS 'Full name of the state (e.g., "Alabama")';
COMMENT ON COLUMN public.states.state_code IS 'Two-letter state code (e.g., "AL")';
COMMENT ON COLUMN public.states.is_active IS 'Whether this state is currently active for business';

-- Enable RLS
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for states
CREATE POLICY "Anyone can view states" 
ON public.states 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert states" 
ON public.states 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

CREATE POLICY "Admins can update states" 
ON public.states 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

-- =====================================================
-- 3. AGENT CARRIER LICENSES TABLE
-- =====================================================
-- Junction table linking agents to carriers they can sell

CREATE TABLE IF NOT EXISTS public.agent_carrier_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  is_licensed BOOLEAN DEFAULT true,
  license_start_date DATE,
  license_end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of agent and carrier
  UNIQUE(agent_user_id, carrier_id)
);

COMMENT ON TABLE public.agent_carrier_licenses IS 'Tracks which carriers each agent is licensed to sell';
COMMENT ON COLUMN public.agent_carrier_licenses.agent_user_id IS 'Reference to the agent user';
COMMENT ON COLUMN public.agent_carrier_licenses.carrier_id IS 'Reference to the carrier';
COMMENT ON COLUMN public.agent_carrier_licenses.is_licensed IS 'Whether the agent is currently licensed for this carrier';
COMMENT ON COLUMN public.agent_carrier_licenses.license_start_date IS 'Optional: When the license became active';
COMMENT ON COLUMN public.agent_carrier_licenses.license_end_date IS 'Optional: When the license expires';

-- Create indexes for performance
CREATE INDEX idx_agent_carrier_licenses_agent ON public.agent_carrier_licenses(agent_user_id);
CREATE INDEX idx_agent_carrier_licenses_carrier ON public.agent_carrier_licenses(carrier_id);
CREATE INDEX idx_agent_carrier_licenses_active ON public.agent_carrier_licenses(agent_user_id, is_licensed) WHERE is_licensed = true;

-- Enable RLS
ALTER TABLE public.agent_carrier_licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Closers can view their own carrier licenses" 
ON public.agent_carrier_licenses 
FOR SELECT 
USING (auth.uid() = agent_user_id);

CREATE POLICY "Admins can view all carrier licenses" 
ON public.agent_carrier_licenses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

CREATE POLICY "Admins can insert carrier licenses" 
ON public.agent_carrier_licenses 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

CREATE POLICY "Admins can update carrier licenses" 
ON public.agent_carrier_licenses 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

CREATE POLICY "Admins can delete carrier licenses" 
ON public.agent_carrier_licenses 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

-- =====================================================
-- 4. AGENT STATE LICENSES TABLE
-- =====================================================
-- Junction table linking agents to states they're licensed in

CREATE TABLE IF NOT EXISTS public.agent_state_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  is_licensed BOOLEAN DEFAULT true,
  license_number TEXT,
  license_start_date DATE,
  license_end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of agent and state
  UNIQUE(agent_user_id, state_id)
);

COMMENT ON TABLE public.agent_state_licenses IS 'Tracks which states each agent is licensed to sell in';
COMMENT ON COLUMN public.agent_state_licenses.agent_user_id IS 'Reference to the agent user';
COMMENT ON COLUMN public.agent_state_licenses.state_id IS 'Reference to the state';
COMMENT ON COLUMN public.agent_state_licenses.is_licensed IS 'Whether the agent is currently licensed in this state';
COMMENT ON COLUMN public.agent_state_licenses.license_number IS 'Optional: The state license number';
COMMENT ON COLUMN public.agent_state_licenses.license_start_date IS 'Optional: When the license became active';
COMMENT ON COLUMN public.agent_state_licenses.license_end_date IS 'Optional: When the license expires';

-- Create indexes for performance
CREATE INDEX idx_agent_state_licenses_agent ON public.agent_state_licenses(agent_user_id);
CREATE INDEX idx_agent_state_licenses_state ON public.agent_state_licenses(state_id);
CREATE INDEX idx_agent_state_licenses_active ON public.agent_state_licenses(agent_user_id, is_licensed) WHERE is_licensed = true;

-- Enable RLS
ALTER TABLE public.agent_state_licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Closers can view their own state licenses" 
ON public.agent_state_licenses 
FOR SELECT 
USING (auth.uid() = agent_user_id);

CREATE POLICY "Admins can view all state licenses" 
ON public.agent_state_licenses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

CREATE POLICY "Admins can insert state licenses" 
ON public.agent_state_licenses 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

CREATE POLICY "Admins can update state licenses" 
ON public.agent_state_licenses 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

CREATE POLICY "Admins can delete state licenses" 
ON public.agent_state_licenses 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.agent_code IS NOT NULL
  )
);

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to get eligible agents for a specific carrier and state
CREATE OR REPLACE FUNCTION public.get_eligible_agents(
  p_carrier_name TEXT,
  p_state_name TEXT
)
RETURNS TABLE (
  agent_user_id UUID,
  agent_name TEXT,
  agent_email TEXT,
  agent_code TEXT,
  carrier_licensed BOOLEAN,
  state_licensed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.user_id,
    p.display_name,
    u.email,
    p.agent_code,
    COALESCE(acl.is_licensed, false) as carrier_licensed,
    COALESCE(asl.is_licensed, false) as state_licensed
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.agent_carrier_licenses acl ON acl.agent_user_id = p.user_id
  LEFT JOIN public.carriers c ON c.id = acl.carrier_id AND LOWER(c.carrier_name) = LOWER(p_carrier_name)
  LEFT JOIN public.agent_state_licenses asl ON asl.agent_user_id = p.user_id
  LEFT JOIN public.states s ON s.id = asl.state_id AND LOWER(s.state_name) = LOWER(p_state_name)
  WHERE 
    -- Agent must be licensed for BOTH carrier AND state
    acl.is_licensed = true 
    AND asl.is_licensed = true
    AND c.is_active = true
    AND s.is_active = true
  ORDER BY p.display_name;
END;
$$;

COMMENT ON FUNCTION public.get_eligible_agents IS 'Returns all agents licensed for a specific carrier and state combination';

-- Function to check if an agent is eligible for a lead
CREATE OR REPLACE FUNCTION public.is_agent_eligible(
  p_agent_user_id UUID,
  p_carrier_name TEXT,
  p_state_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_carrier_licensed BOOLEAN := false;
  v_state_licensed BOOLEAN := false;
BEGIN
  -- Check carrier license
  SELECT COALESCE(acl.is_licensed, false)
  INTO v_carrier_licensed
  FROM public.agent_carrier_licenses acl
  INNER JOIN public.carriers c ON c.id = acl.carrier_id
  WHERE acl.agent_user_id = p_agent_user_id
    AND LOWER(c.carrier_name) = LOWER(p_carrier_name)
    AND c.is_active = true
  LIMIT 1;

  -- Check state license
  SELECT COALESCE(asl.is_licensed, false)
  INTO v_state_licensed
  FROM public.agent_state_licenses asl
  INNER JOIN public.states s ON s.id = asl.state_id
  WHERE asl.agent_user_id = p_agent_user_id
    AND LOWER(s.state_name) = LOWER(p_state_name)
    AND s.is_active = true
  LIMIT 1;

  -- Return true only if licensed for both
  RETURN v_carrier_licensed AND v_state_licensed;
END;
$$;

COMMENT ON FUNCTION public.is_agent_eligible IS 'Checks if a specific agent is eligible for a carrier and state combination';

-- Function to get agent licensing summary
CREATE OR REPLACE FUNCTION public.get_agent_licensing_summary(
  p_agent_user_id UUID
)
RETURNS TABLE (
  total_carriers INTEGER,
  total_states INTEGER,
  carrier_names TEXT[],
  state_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER 
     FROM public.agent_carrier_licenses acl 
     WHERE acl.agent_user_id = p_agent_user_id AND acl.is_licensed = true),
    (SELECT COUNT(*)::INTEGER 
     FROM public.agent_state_licenses asl 
     WHERE asl.agent_user_id = p_agent_user_id AND asl.is_licensed = true),
    (SELECT ARRAY_AGG(c.carrier_name ORDER BY c.carrier_name)
     FROM public.agent_carrier_licenses acl
     INNER JOIN public.carriers c ON c.id = acl.carrier_id
     WHERE acl.agent_user_id = p_agent_user_id AND acl.is_licensed = true),
    (SELECT ARRAY_AGG(s.state_name ORDER BY s.state_name)
     FROM public.agent_state_licenses asl
     INNER JOIN public.states s ON s.id = asl.state_id
     WHERE asl.agent_user_id = p_agent_user_id AND asl.is_licensed = true);
END;
$$;

COMMENT ON FUNCTION public.get_agent_licensing_summary IS 'Returns a summary of all carriers and states an agent is licensed for';

-- =====================================================
-- 6. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

CREATE TRIGGER update_carriers_updated_at
BEFORE UPDATE ON public.carriers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_states_updated_at
BEFORE UPDATE ON public.states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_carrier_licenses_updated_at
BEFORE UPDATE ON public.agent_carrier_licenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_state_licenses_updated_at
BEFORE UPDATE ON public.agent_state_licenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
