import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProofPoint {
  id: string;
  icon: string;
  value: string;
  label: string;
  sub: string | null;
  sort_order: number;
  is_active: boolean;
}

export function useProofPoints(opts?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ["proof-points", { includeInactive: !!opts?.includeInactive }],
    queryFn: async (): Promise<ProofPoint[]> => {
      let q = supabase.from("proof_points").select("*").order("sort_order", { ascending: true });
      if (!opts?.includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProofPoint[];
    },
    staleTime: 60_000,
  });
}
