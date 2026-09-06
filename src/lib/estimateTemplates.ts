import { supabase } from "@/integrations/supabase/client";

export interface EstimateTemplateCustomColumn {
  key: string;
  label: string;
  type: "text" | "number";
}

export interface EstimateTemplateLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  unit: string;
  tax1_rate?: number;
  tax2_rate?: number;
  custom?: Record<string, string | number>;
}

export interface EstimateTemplate {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  is_shared: boolean;

  default_title: string | null;
  currency: string;
  valid_for_days: number | null;

  tax_mode: "none" | "single" | "dual_split" | "compound" | "per_line";
  tax1_label: string;
  tax1_rate: number;
  tax2_label: string;
  tax2_rate: number;
  discount_percent: number;

  dispatch_nbd_tm: number | null;
  dispatch_sbd_tm: number | null;
  dispatch_hourly: number | null;
  dispatch_half_day: number | null;
  dispatch_full_day: number | null;
  dispatch_sbd_hourly: number | null;
  dispatch_sbd_half_day: number | null;
  dispatch_sbd_full_day: number | null;
  dispatch_remarks: string | null;

  notes: string | null;
  branding_enabled: boolean;
  branding_logo_url: string | null;
  branding_primary_color: string | null;
  branding_accent_color: string | null;
  branding_footer_text: string | null;
  branding_company_name: string | null;

  line_items: EstimateTemplateLineItem[];
  custom_columns: EstimateTemplateCustomColumn[];

  created_at: string;
  updated_at: string;
}

export type EstimateTemplateInput = Omit<
  EstimateTemplate,
  "id" | "owner_id" | "created_at" | "updated_at"
>;

export async function listEstimateTemplates(): Promise<EstimateTemplate[]> {
  const { data, error } = await supabase
    .from("estimate_templates" as any)
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data as any[]) || []).map((r) => ({
    ...r,
    line_items: Array.isArray(r.line_items) ? r.line_items : [],
    custom_columns: Array.isArray(r.custom_columns) ? r.custom_columns : [],
  })) as EstimateTemplate[];
}

export async function createEstimateTemplate(input: EstimateTemplateInput): Promise<EstimateTemplate> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("You must be signed in");
  const { data, error } = await supabase
    .from("estimate_templates" as any)
    .insert({ ...input, owner_id: u.user.id, line_items: input.line_items as any, custom_columns: input.custom_columns as any })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as EstimateTemplate;
}

export async function updateEstimateTemplate(
  id: string,
  input: Partial<EstimateTemplateInput>,
): Promise<EstimateTemplate> {
  const payload: any = { ...input };
  if (input.line_items) payload.line_items = input.line_items as any;
  if (input.custom_columns) payload.custom_columns = input.custom_columns as any;
  const { data, error } = await supabase
    .from("estimate_templates" as any)
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as EstimateTemplate;
}

export async function deleteEstimateTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("estimate_templates" as any).delete().eq("id", id);
  if (error) throw error;
}

export const blankEstimateTemplateInput = (): EstimateTemplateInput => ({
  name: "",
  description: null,
  is_shared: false,
  default_title: null,
  currency: "USD",
  valid_for_days: 30,
  tax_mode: "compound",
  tax1_label: "Tax",
  tax1_rate: 0,
  tax2_label: "Tax 2",
  tax2_rate: 0,
  discount_percent: 0,
  dispatch_nbd_tm: null,
  dispatch_sbd_tm: null,
  dispatch_sbd_hourly: null,
  dispatch_sbd_half_day: null,
  dispatch_sbd_full_day: null,
  dispatch_hourly: null,
  dispatch_half_day: null,
  dispatch_full_day: null,
  dispatch_remarks: null,
  notes: null,
  branding_enabled: false,
  branding_logo_url: null,
  branding_primary_color: null,
  branding_accent_color: null,
  branding_footer_text: null,
  branding_company_name: null,
  line_items: [],
  custom_columns: [],
});
