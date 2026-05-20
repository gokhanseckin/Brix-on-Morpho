import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpPopover } from '@/app/components/help/HelpPopover';

describe('HelpPopover', () => {
  it('renders a ? button', () => {
    render(<HelpPopover kpiKey="liquidityFloor" />);
    expect(screen.getByRole('button', { name: /help: liquidity floor/i })).toBeInTheDocument();
  });

  it('opens the popover on click', () => {
    render(<HelpPopover kpiKey="liquidityFloor" />);
    fireEvent.click(screen.getByRole('button', { name: /help: liquidity floor/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/how it's calculated/i)).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<HelpPopover kpiKey="liquidityFloor" />);
    const btn = screen.getByRole('button', { name: /help: liquidity floor/i });
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(btn);
  });

  it('renders a More info link to the right section anchor', () => {
    render(<HelpPopover kpiKey="liquidityFloor" />);
    fireEvent.click(screen.getByRole('button', { name: /help: liquidity floor/i }));
    const link = screen.getByRole('link', { name: /more info/i });
    expect(link).toHaveAttribute('href', '/help/liquidity-need#liquidityFloor');
  });
});
