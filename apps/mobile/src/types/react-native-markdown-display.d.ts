declare module 'react-native-markdown-display' {
  import type { ComponentType } from 'react';
  import type { StyleProp, ViewStyle, TextStyle } from 'react-native';

  interface MarkdownStyles {
    [key: string]: StyleProp<ViewStyle | TextStyle>;
  }

  interface MarkdownProps {
    children: string;
    style?: MarkdownStyles;
  }

  const Markdown: ComponentType<MarkdownProps>;
  export default Markdown;
}
