import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { isTripParticipant } from "@/lib/locked-areas";
import { useActionGate } from "./ActionGate";
import {
  allowanceState,
  assignCommonsLook,
  capeTownTime,
  clampAspect,
  formatBoardDay,
  groupByDay,
  phaseFromSettings,
  phoneAdjust,
  showCounter,
  type CommonsPost,
} from "@/lib/journal";
import {
  PAGE_SIZE,
  createCommonsPost,
  journalErrorMessage,
  useCommonsPosts,
  useJournalPhotoUrls,
  useJournalSettings,
  useMyGuestId,
  uploadJournalPhoto,
} from "@/lib/journal-data";
import { JOURNAL_PHOTO_OPTS, preparePhoto } from "@/lib/image-resize";
import { cn } from "@/lib/utils";

export function JournalCommons() {
  const { roles, loading } = useAuth();
  const settingsQ = useJournalSettings(!loading);
  // Shantell Sans loads on Our Commons only — never on Reflections or Close to Heart.
  const font = <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shantell+Sans:wght@500&display=swap" />;
  if (loading || !settingsQ.data) return <>{font}<div className="h-48 border bg-card" /></>;
  const settings = settingsQ.data;
  const phase = phaseFromSettings(new Date(), settings);
  return <>{font}<CommonsBody phase={phase} roles={roles} settings={settings} /></>;
}

function CommonsBody({ phase, roles, settings }: { phase: "before" | "during" | "after"; roles: string[]; settings: ReturnType<typeof useJournalSettings>["data"] & object }) {
  const { t } = useContent();
  const participant = isTripParticipant(roles as never);
  const isAfar = roles.includes("friend_afar") && !participant;
  const [limit, setLimit] = useState(PAGE_SIZE);
  const postsQ = useCommonsPosts(phase !== "before", limit);
  const posts = useMemo(() => postsQ.data ?? [], [postsQ.data]);
  const photoPaths = useMemo(() => posts.map((p) => p.photo_path).filter((p): p is string => !!p), [posts]);
  const urlsQ = useJournalPhotoUrls(photoPaths);
  const days = useMemo(() => groupByDay(posts), [posts]);

  if (phase === "before") {
    return (
      <section className="space-y-4">
        <div className="journal-notice">
          <h2 className="journal-notice-title">{t("commons_before_title")}</h2>
          <p className="journal-notice-body">{t("commons_before_body")}</p>
        </div>
        {/* The host may post early to test the board. */}
        {roles.includes("host") && <CommonsComposer settings={settings} myPosts={[]} />}
      </section>
    );
  }

  return (
    <section>
      {phase === "after" && <p className="caption-serif mb-6 text-lg text-slate italic">{t("commons_after_line")}</p>}
      {phase === "during" && participant && <CommonsComposer settings={settings} myPosts={posts} />}
      {phase === "during" && !participant && !isAfar && <HonoraryComposerHint />}
      {postsQ.isLoading ? (
        <div className="h-48 border bg-card" />
      ) : posts.length === 0 ? (
        <p className="caption-serif py-10 text-center text-lg italic text-slate">Nothing on the board yet. Be the first to pin something.</p>
      ) : (
        <div className="journal-board">
          {days.map(({ day, posts: dayPosts }) => (
            <div key={day} className="journal-day">
              <h3 className="journal-day-heading">{formatBoardDay(day)}</h3>
              <div className="journal-columns">
                {dayPosts.map((p) => (
                  <CommonsCard key={p.id} post={p} photoUrl={p.photo_path ? urlsQ.data?.[p.photo_path] : undefined} />
                ))}
              </div>
            </div>
          ))}
          {posts.length >= limit && (
            <button className="btn-pill mx-auto mt-2 block" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              Show earlier posts
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function HonoraryComposerHint() {
  const gate = useActionGate("commons");
  return (
    <div className="journal-composer mb-8">
      <p className="journal-composer-label">PIN SOMETHING TO THE BOARD</p>
      <button className="btn-pill btn-pill-solid mt-4" onClick={gate.wrap(() => {})}>
        Pin it
      </button>
      {gate.dialog}
    </div>
  );
}

function CommonsComposer({ settings, myPosts }: { settings: { commonsChars: number; commonsPostsPerDay: number; counterShowAtPct: number }; myPosts: CommonsPost[] }) {
  const queryClient = useQueryClient();
  const myGuestQ = useMyGuestId(true);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; w: number; h: number; preview: string } | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const usedToday = myPosts.filter((p) => p.author_guest_id === myGuestQ.data && new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(p.created_at)) === today).length;
  const allowance = allowanceState(usedToday, settings.commonsPostsPerDay, settings.counterShowAtPct);
  const atLimit = allowance.state === "limit";
  const canSend = !sending && !atLimit && (body.trim().length > 0 || !!photo);

  const pickPhoto = async (file: File) => {
    try {
      const blob = await preparePhoto(file, JOURNAL_PHOTO_OPTS);
      const bmp = await createImageBitmap(blob);
      const preview = URL.createObjectURL(blob);
      setPhoto({ blob, w: bmp.width, h: bmp.height, preview });
      bmp.close();
    } catch (err) {
      toast.error(journalErrorMessage(err));
    }
  };

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const id = crypto.randomUUID();
      let photoPath: string | null = null;
      if (photo) photoPath = await uploadJournalPhoto("commons", id, photo.blob);
      const look = assignCommonsLook(body.trim().length, !!photo);
      await createCommonsPost({
        request_id: id,
        body: body.trim() || null,
        photo_path: photoPath,
        photo_w: photo?.w ?? null,
        photo_h: photo?.h ?? null,
        ...look,
      });
      setBody("");
      setPhoto(null);
      await queryClient.invalidateQueries({ queryKey: ["journal", "commons"] });
      toast.success("Pinned to the board.");
    } catch (err) {
      toast.error(journalErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="journal-composer mb-8">
      <p className="journal-composer-label">PIN SOMETHING TO THE BOARD</p>
      <textarea
        className="journal-textarea mt-3"
        maxLength={settings.commonsChars}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Your note"
      />
      {photo && (
        <div className="mt-3 flex items-center gap-3">
          <img src={photo.preview} alt="Photo to pin" className="h-20 w-20 rounded object-cover" />
          <button className="btn-pill" onClick={() => setPhoto(null)}>Remove photo</button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickPhoto(f);
            e.target.value = "";
          }}
        />
        <button className="btn-pill" onClick={() => fileRef.current?.click()}>Add a photo</button>
        <button className="btn-pill btn-pill-solid" disabled={!canSend} onClick={() => void send()}>
          {sending ? "Pinning…" : "Pin it"}
        </button>
        <span className="ml-auto text-right">
          {showCounter(body.length, settings.commonsChars, settings.counterShowAtPct) && (
            <span className="block text-xs text-slate">{body.length} / {settings.commonsChars}</span>
          )}
          {allowance.state === "remaining" && (
            <span className="block text-xs text-ember-deep">{allowance.left} post{allowance.left === 1 ? "" : "s"} left today</span>
          )}
          {atLimit && (
            <span className="block text-xs text-ember-deep">That's your {settings.commonsPostsPerDay} for today. See you tomorrow.</span>
          )}
        </span>
      </div>
    </div>
  );
}

function CommonsCard({ post, photoUrl }: { post: CommonsPost; photoUrl?: string | undefined }) {
  const [straight, setStraight] = useState(false);
  const isPhone = typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches;
  const adj = isPhone ? phoneAdjust(post.size_pct, post.tilt_deg) : { size_pct: post.size_pct, tilt_deg: post.tilt_deg };
  const style: React.CSSProperties = {
    width: `${adj.size_pct}%`,
    transform: straight ? "rotate(0deg) scale(1.02)" : `rotate(${adj.tilt_deg}deg)`,
  };
  const footer = (
    <div className="journal-card-footer">
      <span className="text-ember-deep">{post.author_name}</span>
      <span className="text-slate">{capeTownTime(post.created_at)}</span>
    </div>
  );
  const tape = (post.card_style === "polaroid" || post.card_style === "note") && <span className="journal-tape" aria-hidden="true" />;

  return (
    <article
      className={cn("journal-card", `journal-card-${post.card_style}`, straight && "is-straight")}
      style={style}
      tabIndex={0}
      role="button"
      aria-pressed={straight}
      onClick={() => setStraight((s) => !s)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); setStraight((s) => !s); }
      }}
    >
      {tape}
      {post.card_style === "note" && (
        <div className={cn("journal-note", post.tint && `journal-note-${post.tint}`)}>
          <p className="journal-card-tag">A NOTE</p>
          <p className="journal-hand" style={{ fontSize: `${Math.round(20 * (post.size_pct / 100) * 1.3)}px` }}>{post.body}</p>
        </div>
      )}
      {post.card_style === "page" && (
        <div className="journal-page">
          {post.stamp && <span className="journal-stamp" aria-hidden="true">30° S</span>}
          <p className="journal-card-tag">A PAGE</p>
          <p className="journal-page-body">{post.body}</p>
        </div>
      )}
      {post.card_style === "book" && (
        <div className="journal-book">
          <p className="journal-book-head">30° SOUTH · 214</p>
          <p className="journal-book-body">{post.body}</p>
          <p className="journal-book-num">{post.page_number}</p>
        </div>
      )}
      {post.card_style === "polaroid" && (
        <div className="journal-polaroid">
          {photoUrl ? (
            <img src={photoUrl} alt={post.body ?? "Pinned photo"} loading="lazy" style={{ aspectRatio: String(clampAspect(post.photo_w, post.photo_h)) }} className="w-full object-cover" />
          ) : (
            <div className="journal-photo-waiting">Photo</div>
          )}
          {post.body && <p className="journal-hand journal-polaroid-caption">{post.body}</p>}
        </div>
      )}
      {post.card_style === "film" && (
        <div className="journal-film">
          <div className="journal-film-strip">
            <span className="journal-film-edge">{post.frame_no ?? ""}</span>
            {photoUrl ? (
              <img src={photoUrl} alt={post.body ?? "Pinned photo"} loading="lazy" style={{ aspectRatio: String(clampAspect(post.photo_w, post.photo_h)) }} className="w-full object-cover" />
            ) : (
              <div className="journal-photo-waiting">Photo</div>
            )}
            <span className="journal-film-edge">30° S 400 · {post.frame_no ?? ""}A</span>
          </div>
          {post.body && <p className="journal-hand journal-film-caption">{post.body}</p>}
        </div>
      )}
      {footer}
    </article>
  );
}
