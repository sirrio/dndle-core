import { useLayoutEffect, useRef, type ReactNode } from "react";

type GameDialogProps = {
  className: string;
  labelledBy: string;
  children: ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  returnFocus?: () => HTMLElement | null;
};

function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element
    && element.isConnected
    && element !== document.body
    && !element.matches(":disabled")
    && !element.closest("[inert]")
    && element.getClientRects().length
    && getComputedStyle(element).visibility !== "hidden");
}

export function GameDialog({ className, labelledBy, children, onClose, closeOnBackdrop = false, returnFocus }: GameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef(returnFocus);
  const backdropPointerDown = useRef(false);

  useLayoutEffect(() => {
    returnFocusRef.current = returnFocus;
  }, [returnFocus]);

  // Opening and scroll locking belong to this mounted dialog, not to its
  // frequently updating children (for example, the next-puzzle countdown).
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      const target = canRestoreFocus(previousFocus) ? previousFocus : returnFocusRef.current?.() ?? null;
      if (canRestoreFocus(target)) target.focus({ preventScroll: true });
    };
  }, []);

  return <dialog
    ref={dialogRef}
    className={className}
    aria-labelledby={labelledBy}
    aria-modal="true"
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]"))
        .filter((element) => element.tabIndex >= 0 && canRestoreFocus(element));
      const first = items[0];
      const last = items.at(-1);
      if (!first) {
        event.preventDefault();
        event.currentTarget.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }}
    onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}
    onPointerDown={(event) => {
      backdropPointerDown.current = event.target === event.currentTarget;
    }}
    onPointerCancel={() => { backdropPointerDown.current = false; }}
    onClick={(event) => {
      if (closeOnBackdrop && backdropPointerDown.current && event.target === event.currentTarget) onClose();
      backdropPointerDown.current = false;
    }}
  >{children}</dialog>;
}
