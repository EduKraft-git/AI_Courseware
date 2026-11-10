import React from 'react';
import { splitFractions } from '../utils/fraction';

interface FractionProps {
  whole?: string;
  num: string;
  den: string;
}

// 위아래로 쌓인 분수 (대분수는 자연수가 왼쪽에 붙습니다)
export const Fraction: React.FC<FractionProps> = ({ whole, num, den }) => (
  <span aria-label={`${whole ? `${whole} ` : ''}${den}분의 ${num}`}>
    {whole && <span className="frac-whole" aria-hidden="true">{whole}</span>}
    <span className="frac" aria-hidden="true">
      <span className="frac-num">{num}</span>
      <span className="frac-den">{den}</span>
    </span>
  </span>
);

// 글 속의 "3/4", "1 1/2"를 분수 모양으로 바꿔서 보여주는 부품
export const MathText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {splitFractions(text).map((part, i) =>
      typeof part === 'string'
        ? <React.Fragment key={i}>{part}</React.Fragment>
        : <Fraction key={i} {...part} />
    )}
  </>
);

