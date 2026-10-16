/**
 * DMI rate card — the single source of truth for every number the studio desk
 * is allowed to say out loud.
 *
 * The concierge reads its prose from the ingested corpus, but prices live HERE,
 * in code, so they can never drift from retrieval, and so a deterministic guard
 * can check every amount the model produces against a known set. Nothing is
 * invented: if a figure is not below, the desk does not know it.
 *
 * Values mirror DMI's published 2025/2026 rate card (recovered from the live
 * site build, October 2026).
 */

export type PortraitLocation = "uyo" | "lagos" | "abuja";
export type PortraitSetting = "indoor" | "outdoor";
export type PortraitKind = "individual" | "couple" | "group";

export const PORTRAIT_LOCATIONS: { id: PortraitLocation; name: string }[] = [
  { id: "uyo", name: "Uyo" },
  { id: "lagos", name: "Lagos" },
  { id: "abuja", name: "Abuja" },
];

export const PORTRAIT_KINDS: { id: PortraitKind; name: string }[] = [
  { id: "individual", name: "Individual" },
  { id: "couple", name: "Couple" },
  { id: "group", name: "Group or Family" },
];

/** Uyo is the home studio: lower rates than Lagos and Abuja. */
const UYO: Record<PortraitSetting, [number, number, number]> = {
  indoor: [50_000, 60_000, 70_000],
  outdoor: [70_000, 80_000, 90_000],
};

const LAGOS_ABUJA: Record<PortraitSetting, [number, number, number]> = {
  indoor: [100_000, 120_000, 150_000],
  outdoor: [150_000, 170_000, 200_000],
};

export interface PortraitRate {
  location: PortraitLocation;
  setting: PortraitSetting;
  kind: PortraitKind;
  price: number;
}

function portraitRates(): PortraitRate[] {
  const kinds: PortraitKind[] = ["individual", "couple", "group"];
  const out: PortraitRate[] = [];
  for (const loc of PORTRAIT_LOCATIONS) {
    const table = loc.id === "uyo" ? UYO : LAGOS_ABUJA;
    for (const setting of ["indoor", "outdoor"] as PortraitSetting[]) {
      kinds.forEach((kind, i) => {
        out.push({ location: loc.id, setting, kind, price: table[setting][i] });
      });
    }
  }
  return out;
}

export const PORTRAIT_RATES: PortraitRate[] = portraitRates();

/** Add-ons that attach to a portrait session. */
export const PORTRAIT_EXTRAS: { name: string; price: number; note: string }[] = [
  { name: "30-second Reel", price: 40_000, note: "Short-form video edit" },
  { name: "Extra Edited Picture", price: 10_000, note: "Per additional retouched photo" },
  { name: "Extra Outfit", price: 0, note: "Same price as your chosen package" },
  { name: "All Unedited Photos", price: 15_000, note: "Uyo only; 20,000 in Lagos and Abuja" },
];

export interface WeddingPackage {
  id: string;
  name: string;
  tagline: string;
  featured?: boolean;
  includes: string[];
  oneEvent: number;
  twoEvents?: number;
  single?: boolean;
}

export const WEDDING_PACKAGES: WeddingPackage[] = [
  {
    id: "pearl",
    name: "Pearl",
    tagline: "Essential photography coverage",
    includes: [
      "Photography, one photographer",
      "30 edited images, 60 for a two-day event",
      "Online gallery",
      "Event photos on flash drive",
      "Complimentary pre-wedding, 2 outfits and 7 edited photos",
    ],
    oneEvent: 600_000,
    twoEvents: 800_000,
  },
  {
    id: "sapphire",
    name: "Sapphire",
    tagline: "Photo and video coverage",
    includes: [
      "Photography, one photographer",
      "Videography, one videographer",
      "30 edited images, 60 for a two-day event",
      "Event photos on flash drive",
      "Trailer video and full-length video",
      "Online gallery",
      "Complimentary pre-wedding, 2 outfits and 7 edited photos",
    ],
    oneEvent: 800_000,
    twoEvents: 1_000_000,
  },
  {
    id: "emerald",
    name: "Emerald",
    tagline: "Premium double-photographer package",
    featured: true,
    includes: [
      "Photography, two photographers",
      "40 edited photos, 80 for a two-day event",
      "One medium photo album, 10 by 24",
      "Medium wall frame 16 by 20, two frames for a two-day event",
      "Event photos on flash drive",
      "Online gallery",
      "Complimentary pre-wedding, 2 outfits and 7 edited photos",
    ],
    oneEvent: 1_000_000,
    twoEvents: 1_200_000,
  },
  {
    id: "diamond",
    name: "Diamond",
    tagline: "The full DMI signature experience",
    includes: [
      "Photography, two photographers",
      "Videography, two videographers",
      "40 edited photos, 80 for a two-day event",
      "Trailer video and full-length video",
      "One medium photo album, 10 by 24",
      "Medium wall frame 16 by 20, two frames for a two-day event",
      "Event photos on flash drive",
      "Online gallery",
      "Complimentary pre-wedding, 2 outfits and 7 edited photos",
    ],
    oneEvent: 1_200_000,
    twoEvents: 1_400_000,
  },
  {
    id: "court",
    name: "Court Marriage",
    tagline: "Intimate courthouse coverage",
    includes: ["Photography, one photographer", "20 edited images", "Online gallery"],
    oneEvent: 100_000,
    single: true,
  },
  {
    id: "introduction",
    name: "Introduction",
    tagline: "Traditional introduction ceremony",
    includes: ["Photography, one photographer", "20 edited images", "Online gallery"],
    oneEvent: 100_000,
    single: true,
  },
];

export const WEDDING_EXTRAS: { name: string; price: number }[] = [
  { name: "Drone, aerial footage", price: 50_000 },
  { name: "Extra photographer, per event", price: 100_000 },
  { name: "Extra videographer, per event", price: 100_000 },
  { name: "Backdrops", price: 70_000 },
  { name: "Content creator", price: 150_000 },
];

export interface StudioSpace {
  id: string;
  name: string;
  price: number;
  minutes: number;
}

export const STUDIO_SPACES: StudioSpace[] = [
  { id: "backdrop-no-ac", name: "Studio Backdrop (without AC)", price: 8_000, minutes: 30 },
  { id: "backdrop-ac", name: "Studio Backdrop (with AC)", price: 10_000, minutes: 30 },
  { id: "content-space", name: "Content Space", price: 20_000, minutes: 30 },
];

export const STUDIO_EXTRAS: { name: string; price: number }[] = [
  { name: "Extra 30 Minutes", price: 0 },
  { name: "Props, per item", price: 5_000 },
  { name: "Flower Pots, per item", price: 5_000 },
  { name: "Chairs, per item", price: 5_000 },
];

export const STORE_PRODUCTS: { id: string; name: string; price: number; format: string }[] = [
  { id: "presets", name: "Lightroom Presets", price: 8_500, format: "Digital download, .xmp and .lrtemplate" },
  { id: "posing-guide", name: "Printed Imagination, the DMI Posing Guide", price: 5_500, format: "PDF ebook, 60 pages" },
  { id: "business-course", name: "Photography as a Business", price: 15_000, format: "Four video lessons plus workbook" },
];

export const ACADEMY = {
  name: "DMI Photography Academy",
  price: 200_000,
  installment: 100_000,
  months: 3,
  days: "Mondays, Wednesdays and Fridays",
  location: "Uyo",
  batches: [
    { id: "A", window: "January to March" },
    { id: "B", window: "May to July" },
    { id: "C", window: "September to November" },
  ],
  paymentAccount: { bank: "FCMB", number: "2008197378" },
  fullPayment: 200_000,
  partPayment: 100_000,
};

/**
 * Every whole-naira amount the desk is allowed to quote.
 *
 * Also the deterministic guard: anything the model says in naira that is not
 * in this set did not come from the rate card, so the route can catch it.
 */
export function allowedAmounts(): number[] {
  const set = new Set<number>();
  for (const r of PORTRAIT_RATES) set.add(r.price);
  for (const e of PORTRAIT_EXTRAS) if (e.price) set.add(e.price);
  for (const w of WEDDING_PACKAGES) {
    set.add(w.oneEvent);
    if (w.twoEvents) set.add(w.twoEvents);
  }
  for (const e of WEDDING_EXTRAS) set.add(e.price);
  for (const s of STUDIO_SPACES) set.add(s.price);
  for (const e of STUDIO_EXTRAS) if (e.price) set.add(e.price);
  for (const p of STORE_PRODUCTS) set.add(p.price);
  set.add(ACADEMY.price);
  set.add(ACADEMY.installment);
  return [...set].sort((a, b) => a - b);
}

/** Format a whole-naira amount the way DMI writes it on the site. */
export function naira(n: number): string {
  return `\u20a6${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Math.round(n || 0))}`;
}

/**
 * A compact, unambiguous rate card handed to the model as its only price
 * source. Kept terse so it reads as notes, not as a wall of text.
 */
export function priceListText(): string {
  const lines: string[] = [];

  lines.push("PORTRAITS (per session, includes 1 outfit and 3 edited images in Uyo; session rate elsewhere)");
  for (const loc of PORTRAIT_LOCATIONS) {
    const table = loc.id === "uyo" ? UYO : LAGOS_ABUJA;
    const kinds = ["individual", "couple", "group"];
    const fish = (s: PortraitSetting) =>
      kinds.map((k, i) => `${k} ${naira(table[s][i])}`).join(", ");
    lines.push(`- ${loc.name} indoor: ${fish("indoor")}. Outdoor: ${fish("outdoor")}.`);
  }
  lines.push(
    "Portrait add-ons: 30-second Reel " +
      naira(40_000) +
      "; Extra Edited Picture " +
      naira(10_000) +
      " each; Extra Outfit same as the package price; All Unedited Photos " +
      naira(15_000) +
      " in Uyo and " +
      naira(20_000) +
      " in Lagos and Abuja.",
  );

  lines.push("");
  lines.push("WEDDINGS (one-day / two-day)");
  for (const w of WEDDING_PACKAGES) {
    const price = w.twoEvents ? `${naira(w.oneEvent)} one day, ${naira(w.twoEvents)} two days` : naira(w.oneEvent);
    lines.push(`- ${w.name}: ${price}. ${w.tagline}.`);
  }
  lines.push(
    "Wedding add-ons: Drone " +
      naira(50_000) +
      "; Extra photographer per event " +
      naira(100_000) +
      "; Extra videographer per event " +
      naira(100_000) +
      "; Backdrops " +
      naira(70_000) +
      "; Content creator " +
      naira(150_000) +
      ".",
  );

  lines.push("");
  lines.push("STUDIO SPACE (per 30 minutes)");
  for (const s of STUDIO_SPACES) lines.push(`- ${s.name}: ${naira(s.price)}.`);
  lines.push("Studio add-ons: Extra 30 minutes matches your space rate; Props, Flower Pots and Chairs " + naira(5_000) + " per item.");

  lines.push("");
  lines.push("STORE");
  for (const p of STORE_PRODUCTS) lines.push(`- ${p.name}: ${naira(p.price)}.`);

  lines.push("");
  lines.push(
    `ACADEMY: ${ACADEMY.name}, ${ACADEMY.months} months in ${ACADEMY.location}, ${ACADEMY.days}. ` +
      `${naira(ACADEMY.price)} full payment, or ${naira(ACADEMY.installment)} in two installments.`,
  );

  return lines.join("\n");
}

export interface PriceScan {
  /** Every naira amount the reply stated. */
  found: number[];
  /** Amounts that are not in the rate card. Empty means the reply is clean. */
  unknown: number[];
  /** Plain-language labels for the offenders, so a correction can be written. */
  unknownLabels: string[];
}

/**
 * Deterministic price guard. Finds every ₦ figure in a reply and reports the
 * ones the rate card does not hold. Run on the whole reply, not on stream
 * chunks, because a figure can be split across chunk boundaries.
 */
export function scanPrices(text: string): PriceScan {
  const allowed = new Set(allowedAmounts());
  const found: number[] = [];
  const unknown: number[] = [];
  const unknownLabels: string[] = [];
  const re = /\u20a6\s?([0-9][0-9,]{1,15})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) continue;
    found.push(value);
    if (!allowed.has(value)) {
      unknown.push(value);
      unknownLabels.push(naira(value));
    }
  }
  return { found, unknown, unknownLabels };
}
