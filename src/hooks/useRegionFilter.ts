import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRegionFilter() {
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  const { data: regions = [] } = useQuery({
    queryKey: ["regions-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("id, name, city").order("name");
      return data ?? [];
    },
  });

  return { regions, selectedRegion, setSelectedRegion };
}
