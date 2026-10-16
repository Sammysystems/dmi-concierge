export interface RentbotProject {
  id?: string;
  slug: string;
  name: string;
  /** The vertical this studio belongs to. Kept as a free string for future packs. */
  vertical?: string;
  /** Short descriptor shown as the hero badge, e.g. "Photography studio · Uyo". */
  kind?: string;
  /** Brand avatar letter. Defaults to the first letter of `name`. */
  initial?: string;
  /**
   * Whether this studio appears in the public directory at "/". Defaults to
   * true; set false to stage a studio (or hide a sample) without removing it.
   */
  listed?: boolean;
  brand: {
    primary: string;
    surface: string;
    text: string;
    /** Optional accent (e.g. a gold used for badges/highlights). */
    accent?: string;
    /**
     * Brand typefaces, by Google Fonts family name (e.g. "Mulish", "Montserrat").
     * Loaded at runtime; when omitted the app falls back to its default font.
     */
    bodyFont?: string;
    headingFont?: string;
  };
  contact: {
    phone: string;
    email: string;
    address: string;
    hours: string;
    /** Digits only, for wa.me links. Falls back to WHATSAPP_NUMBER then a default. */
    whatsapp?: string;
  };
  /** Where the property is. Drives the header line and the desk prompt. */
  geo?: {
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;
    currency?: string;
    locale?: string;
  };
  /** Hero image + optional badge for the studio page. */
  hero?: {
    image?: string;
    badge?: string;
  };
  /** Studio desk widget copy. Falls back to sensible defaults. */
  widget?: {
    title?: string;
    greeting?: string;
    suggestions?: string[];
  };
  /** The studio's own booking page, for the "Book Now" pill on a session card. */
  booking?: string;
  replica: {
    hero: string;
    services?: string[];
    about: string;
    /** Intro line, e.g. "Photography and film, made in Uyo". */
    tagline?: string;
    /** Logo image for the header (its own wordmark). Falls back to the initial. */
    logo?: string;
  };
  gallery?: string[];
  /** Studio content: services, founder, gallery, testimonials, academy. */
  studio?: StudioProfile;
  created_at?: string;
}

/** The extra material a photography studio page needs. */
export interface StudioProfile {
  tagline?: string;
  founder?: { name: string; role?: string; image?: string; bio?: string };
  services?: Array<{ id: string; name: string; blurb: string }>;
  locations?: string[];
  gallery?: string[];
  testimonials?: Array<{ quote: string; author: string; location?: string; image?: string }>;
  academy?: {
    headline?: string;
    body?: string;
    fee?: number;
    installment?: number;
    schedule?: string;
    batches?: string[];
  };
  social?: Array<{ label: string; href: string }>;
}

export interface RentbotChunk {
  id?: number;
  slug: string;
  source_file: string;
  heading: string | null;
  section_index: number;
  text: string;
  embedding?: number[];
  embedding_model?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  slug: string;
  messages?: ChatTurn[];
  question?: string;
}

/** A studio session the studio desk captured. */
export interface SessionHint {
  service?: string;
  location?: string;
  setting?: string;
  date?: string;
  time?: string;
  pkg?: string;
  addons?: string;
  name?: string;
  phone?: string;
  email?: string;
  note?: string;
}

/** The outcome of a captured session, shown back in the chat. */
export interface SessionResultInfo {
  reference: string;
  whatsappUrl: string;
  emailed: boolean;
  service?: string | null;
  location?: string | null;
  date?: string | null;
  pkg?: string | null;
}

export interface ChatResponse {
  answer: string;
  source?: {
    heading: string | null;
    source_file: string;
    similarity: number;
  } | null;
}

export type ChatStreamEvent =
  | { type: "meta"; source: ChatResponse["source"] }
  | { type: "delta"; text: string }
  | { type: "session"; session: SessionHint }
  | { type: "sessioned"; session: SessionResultInfo }
  | { type: "done" };

/** One ingested practice: profile + embedded chunks, persisted as a data file. */
export interface Corpus {
  slug: string;
  project: RentbotProject;
  embedding_model: string;
  dim: number;
  chunks: Array<{
    id: string;
    source_file: string;
    heading: string | null;
    section_index: number;
    text: string;
    embedding: number[];
  }>;
}

export interface CorpusHit {
  id: string;
  heading: string | null;
  source_file: string;
  similarity: number;
}