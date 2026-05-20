import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfoTooltip } from '@/app/components/help/InfoTooltip';

describe('InfoTooltip', () => {
  it('renders an info button with aria-label', () => {
    render(<InfoTooltip text="hello world" />);
    expect(screen.getByRole('button', { name: /more info/i })).toBeInTheDocument();
  });

  it('shows the tooltip text after click', () => {
    render(<InfoTooltip text="hello world" />);
    expect(screen.queryByText('hello world')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /more info/i }));
    expect(screen.getByText('hello world')).toBeVisible();
  });

  it('toggles closed on a second click', () => {
    render(<InfoTooltip text="hello world" />);
    const btn = screen.getByRole('button', { name: /more info/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByText('hello world')).not.toBeInTheDocument();
  });
});
