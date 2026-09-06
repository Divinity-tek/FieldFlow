
-- Chat rooms table
CREATE TABLE public.chat_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'internal_team',
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT chat_rooms_type_check CHECK (type IN ('internal_team', 'job_specific', 'client_support', 'live_chat'))
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Chat room members table
CREATE TABLE public.chat_room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

-- Chat room messages table
CREATE TABLE public.chat_room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_room_messages ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_chat_room_messages_room_id ON public.chat_room_messages(room_id, created_at DESC);
CREATE INDEX idx_chat_room_members_user_id ON public.chat_room_members(user_id);
CREATE INDEX idx_chat_rooms_type ON public.chat_rooms(type);
CREATE INDEX idx_chat_rooms_job_id ON public.chat_rooms(job_id);

-- RLS Policies for chat_rooms
CREATE POLICY "Members can view their rooms"
  ON public.chat_rooms FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT room_id FROM public.chat_room_members WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'team_lead'::app_role)
  );

CREATE POLICY "Authenticated users can create rooms"
  ON public.chat_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can manage all rooms"
  ON public.chat_rooms FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Room creators can update their rooms"
  ON public.chat_rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for chat_room_members
CREATE POLICY "Members can view room members"
  ON public.chat_room_members FOR SELECT
  TO authenticated
  USING (
    room_id IN (SELECT room_id FROM public.chat_room_members crm WHERE crm.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins and room creators can add members"
  ON public.chat_room_members FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'team_lead'::app_role)
    OR auth.uid() = user_id
    OR room_id IN (SELECT id FROM public.chat_rooms WHERE created_by = auth.uid())
  );

CREATE POLICY "Admins can manage all members"
  ON public.chat_room_members FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members can update own membership"
  ON public.chat_room_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members can leave rooms"
  ON public.chat_room_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for chat_room_messages
CREATE POLICY "Members can view room messages"
  ON public.chat_room_messages FOR SELECT
  TO authenticated
  USING (
    room_id IN (SELECT room_id FROM public.chat_room_members WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Members can send messages"
  ON public.chat_room_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND room_id IN (SELECT room_id FROM public.chat_room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all messages"
  ON public.chat_room_messages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_members;

-- Triggers for updated_at
CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
