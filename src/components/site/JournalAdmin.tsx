import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { assignCommonsLook, formatBoardDay, capeTownDay, type CardStyle, type CommonsPost, type HeartCard, type NoteTint } from "@/lib/journal";
import { removeJournalPhoto, useCommonsPosts, useHeartCards, useJournalSettings } from "@/lib/journal-data";
import { SubTabs } from "./Blocks";

type AdminTab = "commons" | "heart" | "reflections" | "settings";

export function JournalAdmin() {
  const { isHost } = useAuth();
  const [tab, setTab] = useState<AdminTab>("commons");
  const active: AdminTab = !isHost && tab === "settings" ? "commons" : tab;
  return (
    <div>
      <SubTabs
        tabs={[
          { id: "commons", label: "Our Commons" },
          { id: "heart", label: "Close to Heart" },
          { id: "reflections", label: "Reflections" },
          ...(isHost ? [{ id: "settings" as AdminTab, label: "Settings" }] : []),
        ]}
        value={active}
        onChange={setTab}
      />
      {active === "commons" && <CommonsAdmin />}
      {active === "heart" && <HeartAdmin />}
      {active === "reflections" && <ReflectionsAdmin />}
      {active === "settings" && isHost && <JournalSettingsAdmin />}
    </div>
  );
}

/* ---------------- Our Commons moderation ---------------- */

function CommonsAdmin() {
  const queryClient = useQueryClient();
  const postsQ = useCommonsPosts(true, 500);
  const posts = useMemo(() => postsQ.data ?? [], [postsQ.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["journal", "commons"] });

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("commons_posts").update({ ...patch, edited_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const remove = async (post: CommonsPost) => {
    const { error } = await supabase.from("commons_posts").delete().eq("id", post.id);
    if (error) { toast.error(error.message); return; }
    await removeJournalPhoto(post.photo_path);
    await refresh();
    toast.success("Post deleted.");
  };

  const reroll = async (post: CommonsPost) => {
    const look = assignCommonsLook(post.body?.length ?? 0, !!post.photo_path);
    await update(post.id, { ...look });
  };

  if (postsQ.isLoading) return <div className="h-48 border bg-card" />;
  return (
    <div className="space-y-4">
      {posts.length === 0 && <p className="caption-serif text-slate">No posts yet.</p>}
      {posts.map((p) => (
        <div key={p.id} className="border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
            <span className="font-medium text-ember-deep">{p.author_name}</span>
            <span>{formatBoardDay(capeTownDay(p.created_at))}</span>
            <span className="uppercase">{p.card_style}</span>
            {p.hidden && <span className="text-ember-deep">HIDDEN</span>}
          </div>
          <textarea
            className="journal-textarea mt-2"
            rows={2}
            defaultValue={p.body ?? ""}
            onBlur={(e) => { if (e.target.value !== (p.body ?? "")) void update(p.id, { body: e.target.value || null }); }}
            aria-label="Post text"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              className="journal-select"
              value={p.card_style}
              onChange={(e) => void update(p.id, { card_style: e.target.value as CardStyle })}
              aria-label="Card type"
            >
              {(["note", "page", "book", "polaroid", "film"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="text-xs text-slate">
              Size
              <input
                type="number" min={72} max={100} defaultValue={p.size_pct}
                className="journal-num ml-1"
                onBlur={(e) => { const v = Math.min(100, Math.max(72, Number(e.target.value) || p.size_pct)); if (v !== p.size_pct) void update(p.id, { size_pct: v }); }}
              />
            </label>
            <label className="text-xs text-slate">
              Tilt
              <input
                type="number" step={0.1} min={-4} max={4} defaultValue={p.tilt_deg}
                className="journal-num ml-1"
                onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== p.tilt_deg) void update(p.id, { tilt_deg: v }); }}
              />
            </label>
            {p.card_style === "note" && (
              <select
                className="journal-select"
                value={p.tint ?? "sand"}
                onChange={(e) => void update(p.id, { tint: e.target.value as NoteTint })}
                aria-label="Tint"
              >
                {(["apricot", "seafoam", "sand"] as const).map((tintOption) => <option key={tintOption} value={tintOption}>{tintOption}</option>)}
              </select>
            )}
            <button className="btn-pill" onClick={() => void reroll(p)}>Re-roll look</button>
            {p.photo_path && (
              <button className="btn-pill" onClick={() => { void removeJournalPhoto(p.photo_path); void update(p.id, { photo_path: null, photo_w: null, photo_h: null }); }}>
                Remove photo
              </button>
            )}
            <button className="btn-pill" onClick={() => void update(p.id, { hidden: !p.hidden })}>{p.hidden ? "Unhide" : "Hide"}</button>
            <button className="btn-pill text-ember-deep" onClick={() => void remove(p)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Close to Heart moderation ---------------- */

function HeartAdmin() {
  const queryClient = useQueryClient();
  const cardsQ = useHeartCards(true);
  const cards = useMemo(() => cardsQ.data ?? [], [cardsQ.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["journal", "heart"] });

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("heart_cards").update({ ...patch, edited_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const remove = async (card: HeartCard) => {
    const { error } = await supabase.from("heart_cards").delete().eq("id", card.id);
    if (error) { toast.error(error.message); return; }
    await removeJournalPhoto(card.photo_path);
    await refresh();
    toast.success("Postcard deleted.");
  };

  if (cardsQ.isLoading) return <div className="h-48 border bg-card" />;
  return (
    <div className="space-y-4">
      {cards.length === 0 && <p className="caption-serif text-slate">No postcards yet.</p>}
      {cards.map((c) => (
        <div key={c.id} className="border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
            <span className="font-medium text-ember-deep">{c.author_name}</span>
            {c.city && <span>{c.city}</span>}
            {c.pinned && <span className="text-deep-atlantic">PINNED</span>}
            {c.hidden && <span className="text-ember-deep">HIDDEN</span>}
          </div>
          <textarea
            className="journal-textarea mt-2"
            rows={2}
            defaultValue={c.body}
            onBlur={(e) => { if (e.target.value !== c.body) void update(c.id, { body: e.target.value }); }}
            aria-label="Postcard message"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="journal-city" maxLength={60} defaultValue={c.city ?? ""} placeholder="City"
              onBlur={(e) => { if (e.target.value !== (c.city ?? "")) void update(c.id, { city: e.target.value || null }); }}
              aria-label="City"
            />
            <button
              className="btn-pill"
              onClick={() => void update(c.id, { pinned: !c.pinned, pinned_at: c.pinned ? null : new Date().toISOString() })}
            >
              {c.pinned ? "Unpin" : "Pin"}
            </button>
            <button className="btn-pill" onClick={() => void update(c.id, { hidden: !c.hidden })}>{c.hidden ? "Unhide" : "Hide"}</button>
            <button className="btn-pill text-ember-deep" onClick={() => void remove(c)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Reflections controls (never entries, authors or counts) ---------------- */

function ReflectionsAdmin() {
  const { isHost } = useAuth();
  if (!isHost) return <p className="caption-serif text-slate">Only the host changes Reflections settings.</p>;
  return (
    <div className="space-y-6">
      <SettingToggle settingKey="reflections_open" label="Reflections is open" />
      <ContentText contentKey="reflections_notice_title" label="Notice title" />
      <ContentText contentKey="reflections_notice_body" label="Notice body" multiline />
      <ContentText contentKey="reflections_message_non_participant" label="Message for honorary guests and friends afar" multiline />
      <ContentText contentKey="reflections_before_title" label="Before-trip box title" />
      <ContentText contentKey="reflections_before_body" label="Before-trip box body" multiline />
      <ContentText contentKey="reflections_closed_message" label="Closed message" multiline />
    </div>
  );
}

/* ---------------- Settings (host only) ---------------- */

const JOURNAL_SETTING_KEYS = [
  "commons_posts_per_day", "commons_chars", "heart_cards_per_person", "heart_photos_per_person",
  "heart_chars", "counter_show_at_pct", "commons_show_honorary", "commons_show_afar",
  "heart_show_honorary", "heart_show_afar", "reflections_open",
  "phase_during_start", "phase_during_end", "phase_override",
];

async function saveSetting(key: string, value: string) {
  const { error } = await supabase.from("settings").upsert({ key, value });
  if (error) toast.error(error.message);
  else toast.success("Saved.");
}

function useSettingValue(key: string) {
  const q = useQuery({
    queryKey: ["admin", "setting", key],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return data?.value ?? "";
    },
  });
  return q.data ?? "";
}

function SettingToggle({ settingKey, label }: { settingKey: string; label: string }) {
  const queryClient = useQueryClient();
  const value = useSettingValue(settingKey);
  const on = value !== "false";
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={async (e) => {
          await saveSetting(settingKey, e.target.checked ? "true" : "false");
          await queryClient.invalidateQueries({ queryKey: ["admin", "setting", settingKey] });
          await queryClient.invalidateQueries({ queryKey: ["journal", "settings"] });
        }}
      />
      {label}
    </label>
  );
}

function SettingText({ settingKey, label, note }: { settingKey: string; label: string; note?: string }) {
  const queryClient = useQueryClient();
  const value = useSettingValue(settingKey);
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="journal-city mt-1 w-full"
        defaultValue={value}
        onBlur={async (e) => {
          if (e.target.value !== value) {
            await saveSetting(settingKey, e.target.value);
            await queryClient.invalidateQueries({ queryKey: ["admin", "setting", settingKey] });
            await queryClient.invalidateQueries({ queryKey: ["journal", "settings"] });
          }
        }}
      />
      {note && <span className="mt-1 block text-xs text-slate">{note}</span>}
    </label>
  );
}

function ContentText({ contentKey, label, multiline }: { contentKey: string; label: string; multiline?: boolean }) {
  const queryClient = useQueryClient();
  const { t } = useContent();
  const value = t(contentKey);
  const save = async (v: string) => {
    const { error } = await supabase.from("site_content").upsert({ key: contentKey, value: v, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message);
    else { toast.success("Saved."); await queryClient.invalidateQueries({ queryKey: ["site_content"] }); }
  };
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {multiline ? (
        <textarea className="journal-textarea mt-1 w-full" rows={3} defaultValue={value} onBlur={(e) => { if (e.target.value !== value) void save(e.target.value); }} />
      ) : (
        <input className="journal-city mt-1 w-full" defaultValue={value} onBlur={(e) => { if (e.target.value !== value) void save(e.target.value); }} />
      )}
    </label>
  );
}

function JournalSettingsAdmin() {
  const queryClient = useQueryClient();
  const settingsQ = useJournalSettings(true);
  const phaseOverride = useSettingValue("phase_override");
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SettingText settingKey="commons_posts_per_day" label="Commons posts per day" />
        <SettingText settingKey="commons_chars" label="Commons character limit" />
        <SettingText settingKey="heart_cards_per_person" label="Postcards per person (total)" />
        <SettingText settingKey="heart_photos_per_person" label="Photo postcards per person" />
        <SettingText settingKey="heart_chars" label="Postcard character limit" />
        <SettingText settingKey="counter_show_at_pct" label="Counter appears at (% of limit)" />
      </div>
      <div className="space-y-3">
        <SettingToggle settingKey="commons_show_honorary" label="Honorary guests see Our Commons" />
        <SettingToggle settingKey="commons_show_afar" label="Friends afar see Our Commons" />
        <SettingToggle settingKey="heart_show_honorary" label="Honorary guests see Close to Heart" />
        <SettingToggle settingKey="heart_show_afar" label="Friends afar see Close to Heart" />
      </div>
      <div className="border-t pt-6">
        <p className="text-sm font-medium">Site phases</p>
        <p className="mt-1 text-xs text-slate">
          These times are in Detroit time and will drive the whole site later.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <SettingText settingKey="phase_during_start" label="Trip begins" note="YYYY-MM-DD HH:mm" />
          <SettingText settingKey="phase_during_end" label="Trip ends" note="YYYY-MM-DD HH:mm" />
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Phase override</span>
          <select
            className="journal-select mt-1 block"
            value={phaseOverride || "auto"}
            onChange={async (e) => {
              await saveSetting("phase_override", e.target.value);
              await queryClient.invalidateQueries({ queryKey: ["admin", "setting", "phase_override"] });
              await queryClient.invalidateQueries({ queryKey: ["journal", "settings"] });
            }}
          >
            {["auto", "before", "during", "after"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate">Current phase: {settingsQ.data ? phaseFromSettingsLabel(settingsQ.data) : "…"}</p>
      </div>
      <div className="border-t pt-6">
        <p className="mb-3 text-sm font-medium">Close to Heart copy</p>
        <div className="space-y-4">
          <ContentText contentKey="heart_tagline" label="Tagline" />
          <ContentText contentKey="heart_to_name" label="Addressed to (name)" />
          <ContentText contentKey="heart_to_place" label="Addressed to (place)" />
          <ContentText contentKey="commons_before_title" label="Commons before-trip title" />
          <ContentText contentKey="commons_before_body" label="Commons before-trip body" multiline />
          <ContentText contentKey="commons_after_line" label="Commons after-trip line" />
        </div>
      </div>
    </div>
  );
}

function phaseFromSettingsLabel(s: { phaseOverride: string }) {
  return s.phaseOverride === "auto" ? "auto (from the dates)" : s.phaseOverride;
}
