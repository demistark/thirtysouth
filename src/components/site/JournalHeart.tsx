import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import {
  allowanceState,
  clampAspect,
  heartCardStyle,
  heartTextColor,
  heartTilt,
  orderHeartCards,
  showCounter,
  type HeartCard,
} from "@/lib/journal";
import {
  createHeartCard,
  journalErrorMessage,
  useHeartCards,
  useJournalPhotoUrls,
  useJournalSettings,
  useMyGuestId,
  uploadJournalPhoto,
} from "@/lib/journal-data";
import { JOURNAL_PHOTO_OPTS, preparePhoto } from "@/lib/image-resize";
import { cn } from "@/lib/utils";

export function JournalHeart() {
  const { session, loading } = useAuth();
  const settingsQ = useJournalSettings(!loading && !!session);
  const cardsQ = useHeartCards(!loading && !!session);
  const cards = useMemo(() => orderHeartCards(cardsQ.data ?? []), [cardsQ.data]);
  const photoPaths = useMemo(() => cards.map((c) => c.photo_path).filter((p): p is string => !!p), [cards]);
  const urlsQ = useJournalPhotoUrls(photoPaths);

  if (loading || !settingsQ.data) return <div className="h-48 border bg-card" />;
  const settings = settingsQ.data;

  return (
    <section>
      <header className="text-center">
        <h2 className="font-display-light text-[44px] text-deep-atlantic" style={{ letterSpacing: "normal" }}>
          Close to Heart
        </h2>
        <Tagline />
        <div className="mx-auto mt-6 h-px w-16 bg-line" />
      </header>
      {session && <HeartComposer settings={settings} myCards={cards} />}
      {cardsQ.isLoading ? (
        <div className="mt-8 h-48 border bg-card" />
      ) : cards.length === 0 ? (
        <p className="caption-serif py-10 text-center text-lg italic text-slate">Postcards will arrive here.</p>
      ) : (
        <div className="journal-wall mt-10">
          <div className="journal-columns">
            {cards.map((c) => (
              <HeartCardView key={c.id} card={c} photoUrl={c.photo_path ? urlsQ.data?.[c.photo_path] : undefined} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Tagline() {
  const { t } = useContent();
  return <p className="caption-serif mt-2 text-[19px] text-slate italic">{t("heart_tagline")}</p>;
}

function HeartComposer({
  settings,
  myCards,
}: {
  settings: { heartChars: number; heartCardsPerPerson: number; heartPhotosPerPerson: number; counterShowAtPct: number };
  myCards: HeartCard[];
}) {
  const { t } = useContent();
  const queryClient = useQueryClient();
  const myGuestQ = useMyGuestId(true);
  const [body, setBody] = useState("");
  const [city, setCity] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; w: number; h: number; preview: string } | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mine = myCards.filter((c) => c.author_guest_id === myGuestQ.data);
  const myPhotos = mine.filter((c) => c.photo_path).length;
  const allowance = allowanceState(mine.length, settings.heartCardsPerPerson, settings.counterShowAtPct);
  const atLimit = allowance.state === "limit";
  const canSend = !sending && !atLimit && body.trim().length > 0;
  const usedCities = [...new Set(myCards.map((c) => c.city).filter((c): c is string => !!c))];

  const pickPhoto = async (file: File) => {
    if (myPhotos >= settings.heartPhotosPerPerson) {
      toast.error(`That's your ${settings.heartPhotosPerPerson} photo postcards. Words are still welcome.`);
      return;
    }
    try {
      const blob = await preparePhoto(file, JOURNAL_PHOTO_OPTS);
      const bmp = await createImageBitmap(blob);
      setPhoto({ blob, w: bmp.width, h: bmp.height, preview: URL.createObjectURL(blob) });
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
      if (photo) photoPath = await uploadJournalPhoto("heart", id, photo.blob);
      await createHeartCard({
        request_id: id,
        body: body.trim(),
        city: city.trim() || null,
        photo_path: photoPath,
        photo_w: photo?.w ?? null,
        photo_h: photo?.h ?? null,
        tilt_deg: heartTilt(),
      });
      setBody("");
      setCity("");
      setPhoto(null);
      await queryClient.invalidateQueries({ queryKey: ["journal", "heart"] });
      toast.success("Postcard sent.");
    } catch (err) {
      toast.error(journalErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="journal-composer mx-auto mt-8 max-w-[720px]">
      <p className="journal-composer-label">SEND A POSTCARD</p>
      <textarea
        className="journal-textarea mt-3"
        maxLength={settings.heartChars}
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Your postcard message"
      />
      <input
        className="journal-city mt-3"
        maxLength={60}
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="City (optional)"
        list="heart-cities"
        aria-label="City"
      />
      <datalist id="heart-cities">
        {usedCities.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {photo && (
        <div className="mt-3 flex items-center gap-3">
          <img src={photo.preview} alt="Postcard photo" className="h-20 w-20 rounded object-cover" />
          <button className="btn-pill" onClick={() => setPhoto(null)}>
            Remove photo
          </button>
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
        <button className="btn-pill" onClick={() => fileRef.current?.click()}>
          Add a photo
        </button>
        <button className="btn-pill btn-pill-solid" disabled={!canSend} onClick={() => void send()}>
          {sending ? "Sending…" : "Send"}
        </button>
        <span className="ml-auto text-right">
          {showCounter(body.length, settings.heartChars, settings.counterShowAtPct) && (
            <span className="block text-xs text-slate">
              {body.length} / {settings.heartChars}
            </span>
          )}
          {allowance.state === "remaining" && (
            <span className="block text-xs text-ember-deep">
              {allowance.left} postcard{allowance.left === 1 ? "" : "s"} left
            </span>
          )}
          {atLimit && (
            <span className="block text-xs text-ember-deep">
              That's your {settings.heartCardsPerPerson} postcards. Thank you.
            </span>
          )}
        </span>
      </div>
      <p className="sr-only">{t("heart_tagline")}</p>
    </div>
  );
}

function HeartCardView({ card, photoUrl }: { card: HeartCard; photoUrl?: string | undefined }) {
  const { t } = useContent();
  return (
    <article
      className={cn("journal-postcard", card.pinned && "is-pinned")}
      style={{ transform: `rotate(${card.tilt_deg}deg)` }}
    >
      {card.pinned && <span className="journal-pinned-tag">PINNED</span>}
      {card.photo_path ? (
        <div className="journal-postcard-photo">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={card.body.slice(0, 60)}
              loading="lazy"
              style={{ aspectRatio: String(clampAspect(card.photo_w, card.photo_h)) }}
              className="w-full object-cover"
            />
          ) : (
            <div className="journal-photo-waiting">Photo</div>
          )}
          <HeartBody card={card} className="mt-3" />
        </div>
      ) : (
        <div className="journal-postcard-split">
          <div className="journal-postcard-message">
            <p className="journal-card-tag">POSTCARD</p>
            <HeartBody card={card} className="mt-2" />
          </div>
          <div className="journal-postcard-address">
            <span className="journal-postcard-stamp">30° S</span>
            <p className="journal-address-line">TO {(t("heart_to_name") || "Demi").toUpperCase()}</p>
            <p className="journal-address-line">{(t("heart_to_place") || "Cape Town").toUpperCase()}</p>
          </div>
        </div>
      )}
      <div className="journal-card-footer">
        <span className="text-ember-deep">{card.author_name}</span>
        <span className="text-slate">{card.city ?? ""}</span>
      </div>
    </article>
  );
}

/** Message text only: Lora italic, with the site-picked size, weight and tone from the card id. */
function HeartBody({ card, className }: { card: HeartCard; className?: string }) {
  const style = heartCardStyle(card.id, card.body.length);
  return (
    <p
      className={cn("journal-postcard-body caption-serif italic", className)}
      style={
        {
          "--heart-size": `${style.sizePx}px`,
          fontWeight: style.weight,
          color: heartTextColor(style.tone, style.sizePx),
        } as CSSProperties
      }
    >
      {card.body}
    </p>
  );
}
