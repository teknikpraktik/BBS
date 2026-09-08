import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  /**
   * Which answer leads: it is listed first, filled in, and takes focus.
   *
   * "cancel", the default, is for a question the user has not yet answered —
   * the dialog offers a way on and keeps the destructive answer quiet
   * underneath. "confirm" is for a question already answered by the gesture
   * that opened it, where the way out is the point and burying it under Cancel
   * only makes the user look twice.
   */
  lead?: 'cancel' | 'confirm';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation. Used for the handful of actions in the app that destroy
 * data. Escape and the backdrop always cancel, whichever answer leads.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  lead = 'cancel',
  onConfirm,
  onCancel,
}: Props): ReactNode {
  const leadRef = useRef<HTMLButtonElement>(null);
  const answers = {
    cancel: { label: cancelLabel, onClick: onCancel },
    confirm: { label: confirmLabel, onClick: onConfirm },
  };
  const follows = lead === 'confirm' ? 'cancel' : 'confirm';

  useEffect(() => {
    leadRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 className="dialog__title" id="dialog-title">
          {title}
        </h2>
        {body ? <p className="dialog__body">{body}</p> : null}
        {/* One filled button and one outlined one, in the order the lead sets.
            The follower stays a full-width button rather than a quiet line, so
            both answers are equally easy to hit: leading decides which one is
            obvious, not which one is reachable. A destructive answer that does
            not lead keeps its quieter treatment. */}
        <div className="dialog__actions">
          <button
            type="button"
            ref={leadRef}
            className="btn btn--primary btn--block"
            onClick={answers[lead].onClick}
          >
            {answers[lead].label}
          </button>
          <button
            type="button"
            className={`btn btn--block ${
              follows === 'confirm' && destructive ? 'btn--destructive' : 'btn--outline'
            }`}
            onClick={answers[follows].onClick}
          >
            {answers[follows].label}
          </button>
        </div>
      </div>
    </div>
  );
}
