"use client";

import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import { getPublicContact } from "@/lib/public-contact";
import { NavLink } from "@/components/NavLink";
import { moreNavLinks, withOptionalBasketLink } from "@/lib/nav";
import { RecentOrderHint } from "@/components/RecentOrderHint";
import { NavUtilityCluster } from "@/components/NavUtilityCluster";

type MobileMenuProps = {
  enableP2QuoteTools?: boolean;
};

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
}

export function MobileMenu({ enableP2QuoteTools = false }: MobileMenuProps) {
  const navLinks = withOptionalBasketLink(enableP2QuoteTools);
  const extraLinks = moreNavLinks();
  const contact = getPublicContact(site);
  const [open, setOpen] = useState(false);
  const dialogId = "mobile-nav-dialog";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = dialog ? getFocusable(dialog) : [];
    focusables[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = getFocusable(dialog);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const triggerEl = triggerRef.current;
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      (previouslyFocused.current ?? triggerEl)?.focus();
    };
  }, [open, close]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-forest/20 text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass dark:border-white/15 dark:text-brass-soft"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-forest/50"
            aria-label="ปิดเมนู"
            onClick={close}
          />
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-label="เมนูนำทาง"
            className="absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col border-l border-white/20 bg-paper/95 shadow-lift backdrop-blur-md pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] dark:border-white/10 dark:bg-forest/90"
          >
            <div className="flex items-center justify-between border-b border-forest/10 px-4 py-4">
              <p className="font-semibold text-brass">{site.name}</p>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-forest/20 text-forest dark:border-white/15 dark:text-paper"
                aria-label="ปิดเมนู"
                onClick={close}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav
              className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
              aria-label="เมนูมือถือ"
            >
              <div className="mb-3 rounded-2xl border border-forest/10 bg-forest-mist/50 px-2 py-2 dark:border-white/10 dark:bg-forest/30">
                <NavUtilityCluster layout="drawer" onNavigate={close} />
              </div>
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  title={link.hint}
                  onClick={close}
                  className="rounded-lg px-3 py-3 text-base font-medium text-ink hover:bg-forest-mist"
                  activeClassName="bg-forest-mist text-forest"
                >
                  <span className="block">{link.label}</span>
                  {link.hint ? (
                    <span className="mt-0.5 block text-xs font-normal text-ink/55">
                      {link.hint}
                    </span>
                  ) : null}
                </NavLink>
              ))}
              <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-ink/45">
                ดูเพิ่ม
              </p>
              {extraLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  title={link.hint}
                  onClick={close}
                  className="rounded-lg px-3 py-3 text-base font-medium text-ink hover:bg-forest-mist"
                  activeClassName="bg-forest-mist text-forest"
                >
                  <span className="block">{link.label}</span>
                  {link.hint ? (
                    <span className="mt-0.5 block text-xs font-normal text-ink/55">
                      {link.hint}
                    </span>
                  ) : null}
                </NavLink>
              ))}
              <div onClick={close}>
                <RecentOrderHint variant="menu" />
              </div>
            </nav>
            <div className="space-y-2 border-t border-forest/10 p-4">
              <NavLink
                href="/contact"
                onClick={close}
                className="flex min-h-11 items-center justify-center rounded-full bg-brass px-4 text-sm font-semibold text-forest"
              >
                ขอใบเสนอราคา
              </NavLink>
              {contact.showPhone ? (
                <a
                  href={site.phoneHref}
                  className="flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-4 text-sm font-semibold text-forest"
                >
                  โทรฝ่ายขาย {site.phoneDisplay}
                </a>
              ) : null}
              {contact.showLine ? (
                <a
                  href={site.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-4 text-sm font-semibold text-forest"
                >
                  แชทไลน์ {site.lineId}
                </a>
              ) : (
                <NavLink
                  href="/contact?intent=message"
                  onClick={close}
                  className="flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-4 text-sm font-semibold text-forest"
                >
                  ส่งแบบฟอร์มติดต่อ
                </NavLink>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
