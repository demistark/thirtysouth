import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_JOURNAL_SETTINGS,
  parseJournalSettings,
  type CommonsLook,
  type CommonsPost,
  type HeartCard,
  type JournalSettings,
  type ReflectionEntry,
} from "./journal";

export const JOURNAL_BUCKET = "journal-photos";
export const PAGE_SIZE = 20;

export function useJournalSettings(enabled: boolean) {
  return useQuery({
    queryKey: ["journal", "settings"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<JournalSettings> => {
      const { data, error } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", [
          "commons_posts_per_day", "commons_chars", "heart_cards_per_person", "heart_photos_per_person",
          "heart_chars", "counter_show_at_pct", "commons_show_afar",
          "heart_show_afar", "reflections_open",
        ]);
      if (error) throw error;
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      return { ...DEFAULT_JOURNAL_SETTINGS, ...parseJournalSettings(m) };
    },
  });
}

/** The signed-in friend's own guest id (null when signed out). */
export function useMyGuestId(enabled: boolean) {
  return useQuery({
    queryKey: ["journal", "my-guest"],
    enabled,
    staleTime: 300_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("my_guest");
      if (error) throw error;
      return data ?? null;
    },
  });
}

async function attachNames<T extends { author_guest_id: string; author_name?: string }>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;
  const { data: dir } = await supabase.rpc("guest_directory");
  const names = new Map((dir ?? []).map((g) => [g.id, g.display_name]));
  return rows.map((r) => ({ ...r, author_name: names.get(r.author_guest_id) ?? "A friend" }));
}

export function useCommonsPosts(enabled: boolean, limit: number) {
  return useQuery({
    queryKey: ["journal", "commons", limit],
    enabled,
    queryFn: async (): Promise<CommonsPost[]> => {
      const { data, error } = await supabase
        .from("commons_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return attachNames((data ?? []) as CommonsPost[]);
    },
  });
}

export function useHeartCards(enabled: boolean) {
  return useQuery({
    queryKey: ["journal", "heart"],
    enabled,
    queryFn: async (): Promise<HeartCard[]> => {
      const { data, error } = await supabase
        .from("heart_cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return attachNames((data ?? []) as HeartCard[]);
    },
  });
}

/** Own reflections only — RLS guarantees no one else's rows are ever returned. */
export function useReflectionEntries(enabled: boolean) {
  return useQuery({
    queryKey: ["journal", "reflections"],
    enabled,
    queryFn: async (): Promise<ReflectionEntry[]> => {
      const { data, error } = await supabase
        .from("reflection_entries")
        .select("id,guest_id,entry_date,body,updated_at")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReflectionEntry[];
    },
  });
}

/** Signed URLs for private journal photos, keyed by storage path. */
export function useJournalPhotoUrls(paths: string[]) {
  const key = [...paths].sort().join("|");
  return useQuery({
    queryKey: ["journal", "photo-urls", key],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(JOURNAL_BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
      return out;
    },
  });
}

export async function uploadJournalPhoto(kind: "commons" | "heart", id: string, blob: Blob): Promise<string> {
  const path = `${kind}/${id}.jpg`;
  const { error } = await supabase.storage.from(JOURNAL_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function removeJournalPhoto(path: string | null) {
  if (!path) return;
  await supabase.storage.from(JOURNAL_BUCKET).remove([path]);
}

export interface CreateCommonsInput extends CommonsLook {
  request_id: string;
  body: string | null;
  photo_path: string | null;
  photo_w: number | null;
  photo_h: number | null;
}

/** Maps database error codes to the messages friends see. */
export function journalErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("daily_limit")) return "That's your lot for today. See you tomorrow.";
  if (msg.includes("card_limit")) return "That's your postcards. Thank you.";
  if (msg.includes("photo_limit")) return "That's your photo postcards. Words are still welcome.";
  if (msg.includes("too_long")) return "That's a little too long — trim a few words.";
  if (msg.includes("commons_not_open")) return "Our Commons opens on November 20.";
  if (msg.includes("empty_post") || msg.includes("empty_card")) return "Write something or add a photo first.";
  if (msg.includes("not_participant") || msg.includes("not_allowed")) return "This part is for the friends on the trip.";
  if (msg.includes("source_size")) return "That photo is over 15 MB — try a smaller one.";
  if (msg.includes("entry_date_future")) return "That date is in the future.";
  return "Something went wrong. Please try again.";
}

export async function createCommonsPost(input: CreateCommonsInput): Promise<CommonsPost> {
  // The generated arg types are non-nullable; the RPC itself accepts nulls.
  const params = {
    _request_id: input.request_id,
    _body: input.body,
    _photo_path: input.photo_path,
    _photo_w: input.photo_w,
    _photo_h: input.photo_h,
    _card_style: input.card_style,
    _size_pct: input.size_pct,
    _tilt_deg: input.tilt_deg,
    _tint: input.tint,
    _stamp: input.stamp,
    _page_number: input.page_number,
    _frame_no: input.frame_no,
  } as never;
  const { data, error } = await supabase.rpc("create_commons_post", params);
  if (error) throw error;
  return data as CommonsPost;
}

export async function createHeartCard(input: {
  request_id: string;
  body: string;
  city: string | null;
  photo_path: string | null;
  photo_w: number | null;
  photo_h: number | null;
  tilt_deg: number;
}): Promise<HeartCard> {
  const params = {
    _request_id: input.request_id,
    _body: input.body,
    _city: input.city,
    _photo_path: input.photo_path,
    _photo_w: input.photo_w,
    _photo_h: input.photo_h,
    _tilt_deg: input.tilt_deg,
  } as never;
  const { data, error } = await supabase.rpc("create_heart_card", params);
  if (error) throw error;
  return data as HeartCard;
}

/** Insert or update the author's entry for a date (one page per date per person). */
export async function saveReflectionEntry(guestId: string, entryDate: string, body: string): Promise<void> {
  const { error } = await supabase
    .from("reflection_entries")
    .upsert({ guest_id: guestId, entry_date: entryDate, body }, { onConflict: "guest_id,entry_date" });
  if (error) throw error;
}
