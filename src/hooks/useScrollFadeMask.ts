import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 🌟 스마트 동적 스크롤 페이드 블러 마스크 훅
 * - 맨 왼쪽(처음 탭): 왼쪽 블러 없음, 오른쪽만 블러
 * - 맨 오른쪽(마지막 탭): 오른쪽 블러 없음, 왼쪽만 블러
 * - 중간 스크롤 중: 좌우 양쪽 모두 블러
 * - 스크롤 불필요: 블러 없음
 */
export const useScrollFadeMask = () => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [fadeMask, setFadeMask] = useState<'none' | 'left' | 'right' | 'both'>('right');

  const updateMask = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    // 스크롤이 필요 없을 정도로 너비가 충분한 경우
    if (maxScroll <= 2) {
      setFadeMask('none');
      return;
    }

    const canScrollLeft = scrollLeft > 3;
    const canScrollRight = scrollLeft < maxScroll - 3;

    if (canScrollLeft && canScrollRight) {
      setFadeMask('both');
    } else if (canScrollLeft) {
      setFadeMask('left');
    } else if (canScrollRight) {
      setFadeMask('right');
    } else {
      setFadeMask('none');
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateMask();

    el.addEventListener('scroll', updateMask, { passive: true });
    window.addEventListener('resize', updateMask);

    // 내부 탭 크기나 DOM 변경 감지
    const observer = new ResizeObserver(updateMask);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', updateMask);
      window.removeEventListener('resize', updateMask);
      observer.disconnect();
    };
  }, [updateMask]);

  return { scrollRef, fadeMask, updateMask };
};
