import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { composeFraction, isFractionAnswer, parseFraction, splitFractions } from '../utils/fraction';
import { MathText } from '../components/MathText';
import { checkAnswer } from '../utils/mathAnswer';

describe('분수 입력칸 값 변환 (fraction)', () => {
  it('칸 값을 기존 채점 형식의 글자로 합친다', () => {
    expect(composeFraction({ whole: '', num: '3', den: '4' })).toBe('3/4');
    expect(composeFraction({ whole: '1', num: '1', den: '2' })).toBe('1 1/2');
    expect(composeFraction({ whole: '2', num: '', den: '' })).toBe('2');
    expect(composeFraction({ whole: '', num: '11', den: '2' })).toBe('11/2');
  });

  it('분자 또는 분모만 채우면 미완성이라 빈 값(제출 불가)이다', () => {
    expect(composeFraction({ whole: '', num: '3', den: '' })).toBe('');
    expect(composeFraction({ whole: '1', num: '', den: '4' })).toBe('');
  });

  it('글자를 칸 값으로 나눈다 (대분수와 가분수를 구분)', () => {
    expect(parseFraction('1 1/2')).toEqual({ whole: '1', num: '1', den: '2' });
    expect(parseFraction('11/2')).toEqual({ whole: '', num: '11', den: '2' });
    expect(parseFraction('2')).toEqual({ whole: '2', num: '', den: '' });
    expect(parseFraction('1 / 2')).toEqual({ whole: '', num: '1', den: '2' });
    expect(parseFraction('')).toEqual({ whole: '', num: '', den: '' });
  });

  it('칸에서 만든 답은 기존 채점 로직으로 정답 처리된다', () => {
    const answers = ['5/4', '1 1/4'];
    expect(checkAnswer(composeFraction({ whole: '1', num: '1', den: '4' }), answers)).toBe(true);
    expect(checkAnswer(composeFraction({ whole: '', num: '5', den: '4' }), answers)).toBe(true);
    expect(checkAnswer(composeFraction({ whole: '', num: '11', den: '4' }), answers)).toBe(false);
  });

  it('정답에 분수가 있을 때만 분수 입력칸을 쓴다', () => {
    expect(isFractionAnswer(['5/4', '1 1/4'])).toBe(true);
    expect(isFractionAnswer(['\\frac{3}{4}'])).toBe(true);
    expect(isFractionAnswer(['1과 1/2'])).toBe(true);
    expect(isFractionAnswer(['4분의 3'])).toBe(true);
    expect(isFractionAnswer(['12'])).toBe(false);
    expect(isFractionAnswer(['0.75'])).toBe(false);
  });
});

describe('글 속 분수 찾기 (splitFractions / MathText)', () => {
  it('AI가 생성한 한글 대분수, 한글 분수, LaTeX 분수, 공백 슬래시도 모두 분수로 변환한다', () => {
    expect(splitFractions('1과 1/2 + 2와 3 / 4')).toEqual([
      { whole: '1', num: '1', den: '2' },
      ' + ',
      { whole: '2', num: '3', den: '4' }
    ]);
    expect(splitFractions('1과 2분의 1과 4분의 3')).toEqual([
      { whole: '1', num: '1', den: '2' },
      '과 ',
      { whole: '', num: '3', den: '4' }
    ]);
    expect(splitFractions('$1\\frac{1}{2} \\div \\frac{3}{4}$')).toEqual([
      { whole: '1', num: '1', den: '2' },
      ' ÷ ',
      { whole: '', num: '3', den: '4' }
    ]);
  });
  it('문장 속 분수와 대분수를 골라낸다', () => {
    expect(splitFractions('식혜 4/5 L를 3명이, 1 1/2 컵')).toEqual([
      '식혜 ',
      { whole: '', num: '4', den: '5' },
      ' L를 3명이, ',
      { whole: '1', num: '1', den: '2' },
      ' 컵'
    ]);
  });

  it('11/2는 대분수가 아닌 하나의 분수로, 나눗셈 앞 숫자는 그대로 둔다', () => {
    expect(splitFractions('11/2')).toEqual([{ whole: '', num: '11', den: '2' }]);
    expect(splitFractions('5 ÷ 3/4')).toEqual(['5 ÷ ', { whole: '', num: '3', den: '4' }]);
  });

  it('분수가 없으면 글자 그대로 보여준다', () => {
    expect(splitFractions('km/h로 12 달리기')).toEqual(['km/h로 12 달리기']);
  });

  it('화면에는 위아래로 쌓인 분수 모양(분자/분모 태그)으로 그려진다', () => {
    const html = renderToStaticMarkup(createElement(MathText, { text: '1 1/2 L' }));
    expect(html).toMatch(/frac-whole[^>]*>1</);
    expect(html).toMatch(/frac-num[^>]*>1</);
    expect(html).toMatch(/frac-den[^>]*>2</);
    expect(html).not.toContain('1/2');
  });
});
