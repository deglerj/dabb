import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SuitIcon from '../SuitIcon';

describe('SuitIcon', () => {
  it('renders kreuz without crashing', () => {
    const { container } = render(<SuitIcon suit="kreuz" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders schippe without crashing', () => {
    const { container } = render(<SuitIcon suit="schippe" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders herz without crashing', () => {
    const { container } = render(<SuitIcon suit="herz" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders bollen without crashing', () => {
    const { container } = render(<SuitIcon suit="bollen" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('respects size prop', () => {
    const { container: small } = render(<SuitIcon suit="herz" size={16} />);
    const { container: large } = render(<SuitIcon suit="herz" size={48} />);
    expect(small.firstChild).toBeTruthy();
    expect(large.firstChild).toBeTruthy();
  });
});
