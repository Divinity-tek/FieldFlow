
-- Helper function to check membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_chat_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE room_id = _room_id AND user_id = _user_id
  )
$$;

-- Replace recursive policies on chat_room_members
DROP POLICY IF EXISTS "Members can view room members" ON public.chat_room_members;
CREATE POLICY "Members can view room members"
ON public.chat_room_members
FOR SELECT
USING (
  public.is_chat_room_member(room_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Replace policy on chat_rooms that also queried chat_room_members directly
DROP POLICY IF EXISTS "Members can view their rooms" ON public.chat_rooms;
CREATE POLICY "Members can view their rooms"
ON public.chat_rooms
FOR SELECT
USING (
  public.is_chat_room_member(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team_lead'::app_role)
);
