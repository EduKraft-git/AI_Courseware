import React, { useState } from 'react';

// 타이틀 옆 미니 도움말 툴팁 팝오버(풍선 도움말) 공통 컴포넌트
export const InfoTooltip: React.FC<{ text: React.ReactNode }> = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span
      className="info-tooltip-wrapper"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="info-tooltip-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onBlur={() => setIsOpen(false)}
        aria-label="안내 도움말"
      >
        i
      </button>
      {isOpen && (
        <div className="info-tooltip-popover">
          {text}
        </div>
      )}
    </span>
  );
};
