import { useEffect, useState } from "react";
import StudioPage from "./StudioPage";
import { useBrandFonts, type BrandFonts } from "../lib/brandFont";
import type { StudioProfile } from "../types";

/** The shape `/api/public/[slug]` hands to the page. Exported so the studio page
 *  can take the exact same profile without a second, drifting interface. */
export interface P {
  slug: string;
  name: string;
  vertical?: string;
  kind?: string;
  initial?: string;
  brand: { primary: string; surface: string; text: string; accent?: string; bodyFont?: string; headingFont?: string };
  contact: { phone: string; email: string; address: string; hours: string; whatsapp?: string };
  geo?: { city?: string; state?: string; country?: string };
  hero?: { image?: string; badge?: string };
  widget?: { title?: string; greeting?: string; suggestions?: string[] };
  /** The studio's own booking page, for the "Book Now" pill on a session card. */
  booking?: string;
  replica: { hero: string; services?: string[]; about: string; tagline?: string; logo?: string };
  gallery: string[];
  studio?: StudioProfile;
}

/** The studio's own site, rendered from its profile, with the studio desk on top. */
export default function ReplicaPage({ slug }: { slug: string }) {
  const [p, setP] = useState<P | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/public/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: P) => setP(d))
      .catch(() => setError(true));
  }, [slug]);

  useBrandFonts(p?.brand as BrandFonts | undefined);

  if (error) {
    return <div className="grid min-h-screen place-items-center bg-[#0f0f0f] text-white/50">This studio page isn't live yet.</div>;
  }
  if (!p) {
    return <div className="grid min-h-screen place-items-center bg-[#0f0f0f] text-white/40">Loading…</div>;
  }

  return <StudioPage p={p} slug={slug} />;
}
