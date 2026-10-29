import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

export const factsOptions = {
  queryKey: ["fun_facts", "active"],
  queryFn: async () => {
    const { data, error } = await supabase.from("fun_facts").select("id,text").eq("active", true);
    if (error) throw error;
    return data ?? [];
  },
};

export function parseFactsCsv(csv: string): { text: string; active: boolean }[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim().replace(/^\uFEFF/, "") });
  if (result.errors.length || !result.meta.fields?.includes("text") || !result.meta.fields.includes("active") || !result.data.length) throw new Error("Invalid CSV");
  return result.data.map((row) => {
    const text = row.text?.trim();
    const active = row.active?.trim().toLowerCase();
    if (!text || (active !== "true" && active !== "false" && active !== "")) throw new Error("Invalid CSV");
    return { text, active: active !== "false" };
  });
}