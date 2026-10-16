import { useEffect } from "react";

/**
 * Brand typefaces, by Google Fonts family name. A property can set these in
 * its `brand` block; the app then loads the family at runtime and applies it,
 * so each studio renders in its own type instead of the app default.
 */
export interface BrandFonts {
  bodyFont?: string;
  headingFont?: string;
}

/** Build a Google Fonts CSS2 URL for the given families, or null if none. */
export function brandFontHref(fonts?: BrandFonts): string | null {
  if (!fonts) return null;
  const families = [...new Set([fonts.headingFont, fonts.bodyFont].filter((f): f is string => !!f && f.trim().length > 0))];
  if (families.length === 0) return null;
  const query = families
    .map((f) => `family=${f.trim().replace(/\s+/g, "+")}:wght@300;400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

/** A CSS font-family stack for one brand family, or undefined if unset. */
export function fontStack(family?: string): string | undefined {
  return family ? `"${family}", system-ui, sans-serif` : undefined;
}

/**
 * Load the brand's Google Fonts into the document. Idempotent: updates a single
 * <link> as the brand changes. Call unconditionally at the top of a component
 * (before any early return).
 */
export function useBrandFonts(fonts?: BrandFonts): void {
  const href = brandFontHref(fonts);
  useEffect(() => {
    if (!href) return;
    const id = "hf-brand-fonts";
    let el = document.getElementById(id) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement("link");
      el.id = id;
      el.rel = "stylesheet";
      document.head.appendChild(el);
    }
    if (el.getAttribute("href") !== href) el.setAttribute("href", href);
  }, [href]);
}
