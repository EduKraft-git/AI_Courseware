import React, { useEffect, useState } from 'react';
import { composeFraction, FractionParts, parseFraction } from '../utils/fraction';
import { MathText } from './MathText';

interface FractionInputProps {
  value: string; // "1 1/2" 같은 글자 (기존 채점/저장 형식 그대로)
  onChange: (value: string) => void;
  solved?: boolean; // 정답을 맞춘 뒤에는 입력칸 대신 분수 모양으로 보여줌
  disabled?: boolean;
}

// 학생이 분수를 칸에 나누어 적는 입력칸: [자연수] [분자 / 분모]
export const FractionInput: React.FC<FractionInputProps> = ({ value, onChange, solved, disabled }) => {
  const [parts, setParts] = useState<FractionParts>(() => parseFraction(value));

  // 문제를 넘나들며 값이 바깥에서 바뀌면 칸도 맞춰줍니다 (입력 중인 미완성 값은 유지)
  useEffect(() => {
    setParts(p => (composeFraction(p) === value ? p : parseFraction(value)));
  }, [value]);

  if (solved) {
    return <div className="frac-input solved"><MathText text={value} /></div>;
  }

  const handleChange = (key: keyof FractionParts) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...parts, [key]: e.target.value.replace(/\D/g, '') }; // 숫자만 허용
    setParts(next);
    onChange(composeFraction(next));
  };

  const box = (key: keyof FractionParts, label: string, placeholder: string) => (
    <input
      className="frac-box"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder}
      value={parts[key]}
      onChange={handleChange(key)}
      disabled={disabled}
    />
  );

  return (
    <div className="frac-input">
      {box('whole', '자연수 (대분수일 때만)', '자연수')}
      <div className="frac-input-stack">
        {box('num', '분자', '분자')}
        <span className="frac-input-bar" />
        {box('den', '분모', '분모')}
      </div>
    </div>
  );
};

