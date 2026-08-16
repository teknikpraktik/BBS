import type { ReactNode } from 'react';

interface Props {
  /** Leading slot: the way back, and nothing else. */
  lead?: ReactNode;
  /** Centre slot: position within a sequence, never a title. */
  center?: ReactNode;
  /** Trailing slot: entrances to elsewhere. */
  trail?: ReactNode;
}

/**
 * The navigation bar every screen wears. It keeps its height with all three
 * slots empty, so the title below always begins on the same line — that
 * steadiness between screens is the whole point of the component.
 */
export function TopBar({ lead, center, trail }: Props): ReactNode {
  return (
    <header className="topbar">
      <div className="topbar__lead">{lead}</div>
      <div className="topbar__center">{center}</div>
      <div className="topbar__trail">{trail}</div>
    </header>
  );
}

interface HeadProps {
  title: string;
  /** A quiet line under the title, for context the title cannot carry. */
  subtitle?: string;
  tight?: boolean;
}

/** The large title block, at one fixed distance below the bar on every screen. */
export function PageHead({ title, subtitle, tight = false }: HeadProps): ReactNode {
  return (
    <div className={`page-head ${tight ? 'page-head--tight' : ''}`}>
      <h1 className="title">{title}</h1>
      {subtitle ? <p className="field__hint">{subtitle}</p> : null}
    </div>
  );
}
