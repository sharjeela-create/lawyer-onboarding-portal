-- Create callback_requests table for BPO-Client Connection requests
CREATE TABLE IF NOT EXISTS public.callback_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id TEXT NOT NULL,
    lead_vendor TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('new_application', 'updating_billing', 'carrier_requirements')),
    notes TEXT NOT NULL,
    customer_name TEXT,
    phone_number TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    requested_by UUID REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_callback_requests_submission_id ON public.callback_requests(submission_id);
CREATE INDEX IF NOT EXISTS idx_callback_requests_lead_vendor ON public.callback_requests(lead_vendor);
CREATE INDEX IF NOT EXISTS idx_callback_requests_status ON public.callback_requests(status);
CREATE INDEX IF NOT EXISTS idx_callback_requests_requested_at ON public.callback_requests(requested_at DESC);

-- Enable RLS
ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Center users can insert their own callback requests
CREATE POLICY "Center users can insert callback requests"
    ON public.callback_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        requested_by = auth.uid()
    );

-- Center users can view their own callback requests
CREATE POLICY "Center users can view their callback requests"
    ON public.callback_requests
    FOR SELECT
    TO authenticated
    USING (
        requested_by = auth.uid()
    );

-- Closers can view all callback requests
CREATE POLICY "Closers can view all callback requests"
    ON public.callback_requests
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.agent_status
            WHERE agent_status.user_id = auth.uid()
        )
    );

-- Closers can update callback requests
CREATE POLICY "Closers can update callback requests"
    ON public.callback_requests
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.agent_status
            WHERE agent_status.user_id = auth.uid()
        )
    );

-- Add comment
COMMENT ON TABLE public.callback_requests IS 'Stores callback requests from BPO centers for client connections';
