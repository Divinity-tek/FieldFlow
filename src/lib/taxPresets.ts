// Global tax presets — pick a country/region to auto-fill mode, labels, and rates.
// Rates are common standard rates; users can still override via the % dropdown or custom input.

import type { TaxMode } from "@/lib/financialDocs";

export interface TaxPreset {
  id: string;
  country: string;        // e.g. "India"
  label: string;          // dropdown label, e.g. "India — GST (CGST+SGST 9%+9%)"
  mode: TaxMode;
  tax1_label: string;
  tax1_rate: number;
  tax2_label?: string;
  tax2_rate?: number;
}

export const TAX_PRESETS: TaxPreset[] = [
  { id: "none",             country: "—",              label: "No preset (custom)",                              mode: "single",     tax1_label: "Tax",     tax1_rate: 0 },

  // Single-rate VAT/GST regimes
  { id: "ae_vat",           country: "UAE",            label: "UAE — VAT 5%",                                    mode: "single",     tax1_label: "VAT",     tax1_rate: 5 },
  { id: "sa_vat",           country: "Saudi Arabia",   label: "Saudi Arabia — VAT 15%",                          mode: "single",     tax1_label: "VAT",     tax1_rate: 15 },
  { id: "gb_vat",           country: "UK",             label: "UK — VAT 20%",                                    mode: "single",     tax1_label: "VAT",     tax1_rate: 20 },
  { id: "eu_de_vat",        country: "Germany",        label: "Germany — VAT 19%",                               mode: "single",     tax1_label: "MwSt",    tax1_rate: 19 },
  { id: "eu_fr_vat",        country: "France",         label: "France — TVA 20%",                                mode: "single",     tax1_label: "TVA",     tax1_rate: 20 },
  { id: "eu_es_vat",        country: "Spain",          label: "Spain — IVA 21%",                                 mode: "single",     tax1_label: "IVA",     tax1_rate: 21 },
  { id: "eu_it_vat",        country: "Italy",          label: "Italy — IVA 22%",                                 mode: "single",     tax1_label: "IVA",     tax1_rate: 22 },
  { id: "eu_nl_vat",        country: "Netherlands",    label: "Netherlands — BTW 21%",                           mode: "single",     tax1_label: "BTW",     tax1_rate: 21 },
  { id: "ie_vat",           country: "Ireland",        label: "Ireland — VAT 23%",                               mode: "single",     tax1_label: "VAT",     tax1_rate: 23 },
  { id: "au_gst",           country: "Australia",      label: "Australia — GST 10%",                             mode: "single",     tax1_label: "GST",     tax1_rate: 10 },
  { id: "nz_gst",           country: "New Zealand",    label: "New Zealand — GST 15%",                           mode: "single",     tax1_label: "GST",     tax1_rate: 15 },
  { id: "sg_gst",           country: "Singapore",      label: "Singapore — GST 9%",                              mode: "single",     tax1_label: "GST",     tax1_rate: 9 },
  { id: "my_sst",           country: "Malaysia",       label: "Malaysia — SST 6%",                               mode: "single",     tax1_label: "SST",     tax1_rate: 6 },
  { id: "id_ppn",           country: "Indonesia",      label: "Indonesia — PPN 11%",                             mode: "single",     tax1_label: "PPN",     tax1_rate: 11 },
  { id: "ph_vat",           country: "Philippines",    label: "Philippines — VAT 12%",                           mode: "single",     tax1_label: "VAT",     tax1_rate: 12 },
  { id: "th_vat",           country: "Thailand",       label: "Thailand — VAT 7%",                               mode: "single",     tax1_label: "VAT",     tax1_rate: 7 },
  { id: "jp_ct",            country: "Japan",          label: "Japan — Consumption Tax 10%",                     mode: "single",     tax1_label: "CT",      tax1_rate: 10 },
  { id: "kr_vat",           country: "South Korea",    label: "South Korea — VAT 10%",                           mode: "single",     tax1_label: "VAT",     tax1_rate: 10 },
  { id: "za_vat",           country: "South Africa",   label: "South Africa — VAT 15%",                          mode: "single",     tax1_label: "VAT",     tax1_rate: 15 },
  { id: "ke_vat",           country: "Kenya",          label: "Kenya — VAT 16%",                                 mode: "single",     tax1_label: "VAT",     tax1_rate: 16 },
  { id: "ng_vat",           country: "Nigeria",        label: "Nigeria — VAT 7.5%",                              mode: "single",     tax1_label: "VAT",     tax1_rate: 7.5 },
  { id: "mx_iva",           country: "Mexico",         label: "Mexico — IVA 16%",                                mode: "single",     tax1_label: "IVA",     tax1_rate: 16 },
  { id: "ar_iva",           country: "Argentina",      label: "Argentina — IVA 21%",                             mode: "single",     tax1_label: "IVA",     tax1_rate: 21 },
  { id: "cl_iva",           country: "Chile",          label: "Chile — IVA 19%",                                 mode: "single",     tax1_label: "IVA",     tax1_rate: 19 },
  { id: "ch_vat",           country: "Switzerland",    label: "Switzerland — VAT 8.1%",                          mode: "single",     tax1_label: "VAT",     tax1_rate: 8.1 },
  { id: "tr_kdv",           country: "Türkiye",        label: "Türkiye — KDV 20%",                               mode: "single",     tax1_label: "KDV",     tax1_rate: 20 },

  // Dual-split regimes (two parallel taxes)
  { id: "in_gst_intra_18",  country: "India",          label: "India — GST 18% (CGST 9 + SGST 9)",               mode: "dual_split", tax1_label: "CGST",    tax1_rate: 9,    tax2_label: "SGST", tax2_rate: 9 },
  { id: "in_gst_intra_12",  country: "India",          label: "India — GST 12% (CGST 6 + SGST 6)",               mode: "dual_split", tax1_label: "CGST",    tax1_rate: 6,    tax2_label: "SGST", tax2_rate: 6 },
  { id: "in_gst_intra_5",   country: "India",          label: "India — GST 5% (CGST 2.5 + SGST 2.5)",            mode: "dual_split", tax1_label: "CGST",    tax1_rate: 2.5,  tax2_label: "SGST", tax2_rate: 2.5 },
  { id: "in_igst_18",       country: "India",          label: "India — IGST 18% (interstate)",                   mode: "single",     tax1_label: "IGST",    tax1_rate: 18 },
  { id: "ca_hst_on",        country: "Canada (ON)",    label: "Canada Ontario — HST 13%",                        mode: "single",     tax1_label: "HST",     tax1_rate: 13 },
  { id: "ca_gst_qst",       country: "Canada (QC)",    label: "Canada Quebec — GST 5% + QST 9.975%",             mode: "compound",   tax1_label: "GST",     tax1_rate: 5,    tax2_label: "QST",  tax2_rate: 9.975 },
  { id: "ca_gst_pst_bc",    country: "Canada (BC)",    label: "Canada BC — GST 5% + PST 7%",                     mode: "dual_split", tax1_label: "GST",     tax1_rate: 5,    tax2_label: "PST",  tax2_rate: 7 },
  { id: "br_icms_ipi",      country: "Brazil",         label: "Brazil — ICMS 18% + IPI 5% (compound)",           mode: "compound",   tax1_label: "ICMS",    tax1_rate: 18,   tax2_label: "IPI",  tax2_rate: 5 },
  { id: "us_sales_tax",     country: "USA",            label: "USA — Sales tax (set rate manually)",             mode: "single",     tax1_label: "Sales Tax", tax1_rate: 0 },
];

// Common percentage choices for the rate dropdowns. "Custom" handled in the UI.
export const COMMON_TAX_RATES = [
  0, 2.5, 3, 5, 6, 7, 7.5, 8, 8.1, 9, 9.975, 10, 11, 12, 12.5, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27,
];
