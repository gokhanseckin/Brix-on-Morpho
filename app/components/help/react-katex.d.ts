declare module 'react-katex' {
  import { FC, ReactNode } from 'react';

  interface BlockMathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
  }

  interface InlineMathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
  }

  export const BlockMath: FC<BlockMathProps>;
  export const InlineMath: FC<InlineMathProps>;
}
