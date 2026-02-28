
-- Storage bucket for resumes
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

-- Only authenticated admin/managers can read resumes
CREATE POLICY "Admin can view resumes" ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND public.is_admin_or_manager(auth.uid()));

-- Anyone can upload a resume (public form)
CREATE POLICY "Anyone can upload resumes" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

-- Table to store job applications
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  position TEXT NOT NULL,
  message TEXT,
  resume_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application
CREATE POLICY "Anyone can submit application" ON public.job_applications
  FOR INSERT WITH CHECK (true);

-- Only admin/manager can view applications
CREATE POLICY "Admin can view applications" ON public.job_applications
  FOR SELECT USING (public.is_admin_or_manager(auth.uid()));
