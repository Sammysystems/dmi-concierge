import { useEffect } from "react";
import { Calendar, Camera, GraduationCap, Heart, Home, Mail, MapPin, MessageCircle, Phone, Star, Video } from "lucide-react";
import StudioDeskWidget from "./StudioDeskWidget";
import { fontStack } from "../lib/brandFont";
import { ACADEMY, naira } from "../lib/prices";
import type { P as Profile } from "./ReplicaPage";

const SERVICE_ICONS: Record<string, typeof Camera> = {
  portraits: Camera,
  weddings: Heart,
  videography: Video,
  events: Calendar,
  studios: Home,
  academy: GraduationCap,
};

const PILLARS = [
  { num: "01", title: "PRO EXPERT", subtitle: "INNOVATION", desc: "Industry-level expertise delivering strategic, creative solutions with precision and confidence." },
  { num: "02", title: "AWARD WINNING", subtitle: "RECOGNITION", desc: "Recognised for excellence through award-winning creativity, innovation and consistent performance." },
  { num: "03", title: "CLIENT SUCCESS", subtitle: "RESULTS", desc: "More than 95% of clients achieve better brand recognition and results through our creative services." },
  { num: "04", title: "SMART PRICING", subtitle: "VALUE", desc: "Flexible and transparent pricing designed to deliver maximum value without compromise." },
];

/** The live booking page clients are sent to when they already know the date. */
const DEFAULT_BOOKING_URL = "https://dmi.com.ng/booking";

/** DarlMac Impression: the studio's own site, dark and editorial, with the
 *  studio desk in the corner. One page, one purpose — start a session. */
export default function StudioPage({ p, slug }: { p: Profile; slug: string }) {
  const bodyFont = fontStack(p.brand.bodyFont);
  const headingFont = fontStack(p.brand.headingFont);
  const studio = p.studio;
  const founder = studio?.founder;
  const academy = studio?.academy;
  const gallery = studio?.gallery?.length ? studio.gallery : p.gallery;
  const tel = `tel:${p.contact.phone.replace(/[^0-9]/g, "")}`;
  const wa = p.contact.whatsapp ? `https://wa.me/${p.contact.whatsapp}` : "";
  const socials = studio?.social ?? [];
  const logo = p.replica.logo ?? "/images/dmi/dmi-logo-white-D1sFj5k_.png";
  const bookingUrl = p.booking ?? DEFAULT_BOOKING_URL;

  const openDesk = () => window.dispatchEvent(new CustomEvent(`${slug}:session`));

  useEffect(() => {
    document.title = `${p.name} — Photography Studio in Uyo, Lagos & Abuja`;
  }, [p.name]);

  return (
    <div className="studio-scope min-h-screen bg-[#0f0f0f] text-[#f5f5f5]" style={{ fontFamily: bodyFont }}>
      <style>{`
        .studio-scope h1,.studio-scope h2,.studio-scope h3,.studio-scope .dsp{font-family:${headingFont ?? "Oswald, sans-serif"};}
        .studio-scope .dsp{text-transform:uppercase;letter-spacing:.01em;}
        .studio-scope .rule{border-color:rgba(255,255,255,.1);}
      `}</style>

      {/* brand strip */}
      <div className="overflow-hidden bg-[#e40014] py-2 text-center text-[11px] font-bold uppercase tracking-[0.35em] text-white">
        Wedding · Maternity · Birthday · Fine Art · Fashion
      </div>

      {/* nav */}
      <header className="sticky top-0 z-40 border-b rule bg-[#0f0f0f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 lg:px-8">
          <a href="#top" className="flex items-center">
            <img src={logo} alt={p.name} className="h-11 w-auto" />
          </a>
          <nav className="hidden items-center gap-7 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60 md:flex">
            <a href="#work" className="transition hover:text-[#e40014]">Work</a>
            <a href="#services" className="transition hover:text-[#e40014]">Services</a>
            <a href="#founder" className="transition hover:text-[#e40014]">About</a>
            <a href="#academy" className="transition hover:text-[#e40014]">Academy</a>
            <a href="#contact" className="transition hover:text-[#e40014]">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href={tel} className="hidden rounded-full border border-white/15 px-4 py-2 text-[12px] font-semibold text-white/80 transition hover:border-white/40 sm:block">
              Call
            </a>
            <button onClick={openDesk} className="rounded-full bg-[#e40014] px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white transition hover:brightness-110">
              Book a session
            </button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section id="top" className="relative">
        <img src={p.hero?.image ?? gallery[0]} alt={p.name} className="h-[74vh] min-h-[520px] w-full object-cover object-center" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,15,15,.55) 0%, rgba(15,15,15,.35) 40%, rgba(15,15,15,.96) 100%)" }} />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-5 pb-14 lg:px-8">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
              <Star className="size-3.5 fill-[#e40014] text-[#e40014]" />
              {p.hero?.badge ?? p.kind}
            </p>
            <h1 className="dsp max-w-4xl text-5xl font-extrabold leading-[0.95] sm:text-6xl lg:text-[86px]">
              Printed<br />imagination
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/70">{p.replica.tagline ?? p.replica.hero}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={openDesk} className="flex items-center gap-2 rounded-full bg-[#e40014] px-7 py-3.5 text-sm font-bold text-white transition hover:brightness-110">Talk to Support</button>
              <a href={bookingUrl} className="flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#0f0f0f] transition hover:bg-white/90">
                Book Now
              </a>
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-white/60">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* trust strip */}
      <div className="border-y rule bg-[#151515]">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-white/10 px-5 lg:px-8">
          {[
            { n: "300+", l: "Projects Delivered" },
            { n: "07", l: "Years Behind the Lens" },
            { n: "5.0", l: "Average Client Rating" },
          ].map((s) => (
            <div key={s.l} className="px-4 py-7 text-center">
              <p className="dsp text-3xl font-extrabold sm:text-4xl">{s.n}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-white/45">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* services */}
      <section id="services" className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#e40014]">What we do</p>
        <h2 className="dsp mt-3 text-4xl font-extrabold sm:text-6xl">Six ways to work with us</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {(studio?.services ?? []).map((s) => {
            const Icon = SERVICE_ICONS[s.id] ?? Camera;
            return (
              <div key={s.id} className="group bg-[#111] p-7 transition hover:bg-[#161616]">
                <span className="flex size-11 items-center justify-center rounded-full bg-white/8 text-white transition group-hover:bg-[#e40014]">
                  <Icon className="size-5" />
                </span>
                <h3 className="dsp mt-5 text-2xl font-bold">{s.name}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{s.blurb}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* work */}
      <section id="work" className="mx-auto max-w-6xl px-5 pb-20 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#e40014]">Signature work</p>
            <h2 className="dsp mt-3 text-4xl font-extrabold sm:text-6xl">Selected frames</h2>
          </div>
          <p className="hidden max-w-xs text-right text-[13px] leading-relaxed text-white/50 sm:block">
            Cinematic light, deep skin tones, and the stillness that only comes when a subject feels truly seen.
          </p>
        </div>
        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {gallery.map((g, i) => (
            <img
              key={g}
              src={g}
              alt={`${p.name} work ${i + 1}`}
              loading="lazy"
              className={`h-52 w-full rounded-lg object-cover transition duration-500 hover:opacity-90 sm:h-64 ${i % 5 === 0 ? "col-span-2 row-span-2 sm:h-full sm:min-h-[340px]" : ""}`}
            />
          ))}
        </div>
      </section>

      {/* pillars */}
      <section className="border-y rule bg-[#131313]">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
          {PILLARS.map((t) => (
            <div key={t.num} className="flex flex-col gap-4 border-b border-white/10 py-8 last:border-b-0 md:flex-row md:gap-10">
              <span className="w-16 text-[11px] font-semibold tracking-[0.2em] text-white/40">{t.num}</span>
              <h3 className="dsp flex-1 text-3xl font-extrabold sm:text-5xl">{t.title}</h3>
              <div className="md:w-72">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e40014]">{t.subtitle}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* founder */}
      <section id="founder" className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            {founder?.image ? <img src={founder.image} alt={founder.name} className="aspect-[3/4] w-full rounded-xl object-cover" /> : null}
            <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-white/45">{founder?.name} · {founder?.role}</p>
          </div>
          <div className="md:col-span-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#e40014]">About the founder</p>
            <h2 className="dsp mt-3 text-4xl font-extrabold leading-[1.05] sm:text-5xl">
              Meet {founder?.name}<br />the eye behind DMI
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-white/65">{founder?.bio}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65">{p.replica.about}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={openDesk} className="rounded-full bg-[#e40014] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110">
                Book with the studio
              </button>
              <a href={tel} className="flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/50">
                <Phone className="size-4" /> {p.contact.phone}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* testimonials */}
      <section className="border-y rule bg-[#131313]">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#e40014]">Client words</p>
          <h2 className="dsp mt-3 text-4xl font-extrabold sm:text-5xl">Trusted worldwide</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {(studio?.testimonials ?? []).map((t) => (
              <figure key={t.author} className="rounded-2xl bg-white/[.04] p-6 ring-1 ring-white/10">
                <Star className="size-4 fill-[#e40014] text-[#e40014]" />
                <blockquote className="mt-4 text-[15px] leading-relaxed text-white/80">“{t.quote}”</blockquote>
                <figcaption className="mt-5 text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {t.author}{t.location ? ` · ${t.location}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* academy */}
      <section id="academy" className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <div className="grid gap-8 rounded-3xl bg-[#e40014] p-8 sm:p-12 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">Learn with us</p>
            <h2 className="dsp mt-3 text-4xl font-extrabold text-white sm:text-5xl">{academy?.headline}</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/85">{academy?.body}</p>
          </div>
          <div className="text-white">
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between border-b border-white/25 pb-2"><span className="font-semibold">Duration</span><span>{academy?.schedule}</span></li>
              <li className="flex justify-between border-b border-white/25 pb-2"><span className="font-semibold">Full payment</span><span>{naira(ACADEMY.price)}</span></li>
              <li className="flex justify-between border-b border-white/25 pb-2"><span className="font-semibold">Two installments</span><span>{naira(ACADEMY.installment)} each</span></li>
              <li className="flex justify-between border-b border-white/25 pb-2"><span className="font-semibold">Location</span><span>Uyo, Akwa Ibom</span></li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              {(academy?.batches ?? []).map((b) => (
                <span key={b} className="rounded-full bg-black/20 px-3 py-1.5 text-[11px] font-semibold">{b}</span>
              ))}
            </div>
            <button onClick={openDesk} className="mt-7 w-full rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#e40014] transition hover:bg-white/90">
              Ask about the next intake
            </button>
          </div>
        </div>
      </section>

      {/* contact */}
      <section id="contact" className="border-t rule bg-[#131313]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3 lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#e40014]">Where we shoot</p>
            <div className="mt-5 space-y-4 text-sm text-white/70">
              {(studio?.locations ?? []).map((c) => (
                <p key={c} className="flex items-start gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-[#e40014]" /> {c} studio</p>
              ))}
              <p className="flex items-start gap-2.5"><Home className="mt-0.5 size-4 shrink-0 text-[#e40014]" /> {p.contact.address}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#e40014]">Talk to us</p>
            <div className="mt-5 space-y-4 text-sm text-white/70">
              <a href={tel} className="flex items-center gap-2.5 transition hover:text-white"><Phone className="size-4 text-[#e40014]" /> {p.contact.phone}</a>
              <a href={`mailto:${p.contact.email}`} className="flex items-center gap-2.5 transition hover:text-white"><Mail className="size-4 text-[#e40014]" /> {p.contact.email}</a>
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 transition hover:text-white"><MessageCircle className="size-4 text-[#e40014]" /> WhatsApp us</a>
              ) : null}
              {p.contact.hours ? <p className="flex items-center gap-2.5"><Star className="size-4 text-[#e40014]" /> {p.contact.hours}</p> : null}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#e40014]">Follow the work</p>
            <div className="mt-5 flex flex-col gap-3">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="text-sm text-white/70 underline-offset-4 transition hover:text-white hover:underline">
                  {s.label}
                </a>
              ))}
            </div>
            <button onClick={openDesk} className="mt-7 w-full rounded-full bg-[#e40014] px-6 py-3.5 text-sm font-bold text-white transition hover:brightness-110">
              Talk to Support
            </button>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t rule">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-12 text-center lg:px-8">
          <img src={logo} alt={p.name} className="h-12 w-auto opacity-95" />
          <p className="text-sm italic text-white/50">…printed imagination</p>
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/35">
            © DMI (DarlMac Impression). All rights reserved.
          </p>
          <p className="max-w-xl text-[11px] leading-relaxed text-white/30">
            Demo build. The studio desk answers from DarlMac Impression's published rate card and service information.
          </p>
        </div>
      </footer>

      <StudioDeskWidget
        slug={slug}
        brand={p.brand}
        title={p.widget?.title ?? "DMI Studio Desk"}
        greeting={p.widget?.greeting}
        suggestions={p.widget?.suggestions}
        bodyFont={p.brand.bodyFont}
        headingFont={p.brand.headingFont}
        bookingUrl={bookingUrl}
      />
    </div>
  );
}
