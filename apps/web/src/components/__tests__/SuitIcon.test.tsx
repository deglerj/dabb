import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SuitIcon from '../SuitIcon';

describe('SuitIcon', () => {
  it('renders an img element for each suit', () => {
    const suits = ['kreuz', 'schippe', 'herz', 'bollen'] as const;

    for (const suit of suits) {
      const { container } = render(<SuitIcon suit={suit} />);
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img?.alt).toBe(suit);
    }
  });

  it('uses default size of 24', () => {
    const { container } = render(<SuitIcon suit="herz" />);
    const img = container.querySelector('img');
    expect(img?.width).toBe(24);
    expect(img?.height).toBe(24);
  });

  it('accepts custom size', () => {
    const { container } = render(<SuitIcon suit="herz" size={40} />);
    const img = container.querySelector('img');
    expect(img?.width).toBe(40);
    expect(img?.height).toBe(40);
  });

  it('applies className when provided', () => {
    const { container } = render(<SuitIcon suit="herz" className="custom-class" />);
    const img = container.querySelector('img');
    expect(img?.classList.contains('custom-class')).toBe(true);
  });

  it('renders inline-block with vertical-align middle', () => {
    const { container } = render(<SuitIcon suit="kreuz" />);
    const img = container.querySelector('img') as HTMLElement;
    expect(img.style.display).toBe('inline-block');
    expect(img.style.verticalAlign).toBe('middle');
  });
});
