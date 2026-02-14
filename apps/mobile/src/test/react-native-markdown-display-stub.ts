/**
 * Stub for react-native-markdown-display in tests.
 * The real library contains JSX in .js files which Vitest/Vite cannot parse.
 */

import React from 'react';

function Markdown({ children }: { children: string }) {
  return React.createElement('div', { 'data-testid': 'markdown' }, children);
}

export default Markdown;
