
CREATE TABLE public.ai_tool_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Custom',
  prompt TEXT NOT NULL,
  structured BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_tool_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own presets" ON public.ai_tool_presets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own presets" ON public.ai_tool_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own presets" ON public.ai_tool_presets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own presets" ON public.ai_tool_presets
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_tool_presets_updated_at
  BEFORE UPDATE ON public.ai_tool_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_tool_presets_user ON public.ai_tool_presets(user_id, sort_order);
