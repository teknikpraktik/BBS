import type { ReactNode } from 'react';

interface Props {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

/** Icon-only control. The accessible name is always explicit. */
export function IconButton({ label, onClick, children }: Props): ReactNode {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}
