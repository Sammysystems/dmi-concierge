import { useEffect, useState } from "react";
import StudioDeskWidget from "./StudioDeskWidget";
import { useBrandFonts, type BrandFonts } from "../lib/brandFont";
import type { P } from "./ReplicaPage";

/** Fallback booking page when the profile does not name one. */
const BOOKING_URL = "https://dmi.com.ng/booking";

/**
 * The desk as a bare, embeddable panel. Loaded inside the embed iframe by
 * `public/embed.js`, so it fills the frame edge to edge on a transparent
 * background (the frame's own rounded corners and shadow are the client's
 * chrome, not ours). Everything else - brand, fonts, greeting - comes from the
 * same profile the full studio page uses.
 */
export default function EmbedDesk({ slug }: { slug: string }) {
  const [p, setP] = useState<P | null>(null);

  useEffect(() => {
    fetch(`/api/public/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: P) => setP(d))
      .catch(() => setP(null));
  }, [slug]);

  useBrandFonts(p?.brand as BrandFonts | undefined);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.background;
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      root.style.background = prev;
    };
  }, []);

  return (
    <StudioDeskWidget
      embedded
      slug={slug}
      brand={p?.brand}
      title={p?.widget?.title}
      greeting={p?.widget?.greeting}
      suggestions={p?.widget?.suggestions}
      bodyFont={p?.brand?.bodyFont}
      headingFont={p?.brand?.headingFont}
      bookingUrl={p?.booking ?? BOOKING_URL}
    />
  );
}
