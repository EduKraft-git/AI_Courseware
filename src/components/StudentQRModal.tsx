import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { loadAppConfig } from '../config/appConfig';
import { generateStudentShareUrl } from '../utils/shareConfig';

interface StudentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudentQRModal: React.FC<StudentQRModalProps> = ({ isOpen, onClose }) => {
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const config = loadAppConfig();
      const isConfigured = !!(config.firebaseConfig && config.firebaseConfig.apiKey);
      setHasConfig(isConfigured);

      const url = generateStudentShareUrl(config);
      setShareUrl(url);

      // QRCode를 Data URL(Base64 이미지)로 확실하게 변환
      QRCode.toDataURL(
        url,
        {
          width: 280,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        }
      )
        .then((dataUrl) => {
          setQrDataUrl(dataUrl);
          setLoading(false);
        })
        .catch((err) => {
          console.error('로컬 QR 생성 실패, 온라인 대체 생성기 시도:', err);
          // 실패 시 fallback: 오픈 API로 QR 코드 보장
          const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
          setQrDataUrl(fallbackUrl);
          setLoading(false);
        });

      setCopySuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 링크 클립보드 복사
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // QR 코드 이미지 파일로 다운로드
  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = '우리반_학생접속_QR코드.png';
    link.href = qrDataUrl;
    link.click();
  };

  // 인쇄하기 창 열기
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !qrDataUrl) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>학생 접속용 QR 코드 인쇄</title>
          <style>
            body {
              font-family: 'Pretendard', sans-serif;
              text-align: center;
              padding: 40px 20px;
              color: #111;
            }
            .container {
              max-width: 480px;
              margin: 0 auto;
              border: 2px dashed #333;
              padding: 30px;
              border-radius: 16px;
            }
            h1 { font-size: 24px; margin-bottom: 8px; }
            p { font-size: 15px; color: #555; margin-bottom: 24px; }
            img { width: 280px; height: 280px; }
            .url {
              word-break: break-all;
              font-size: 12px;
              color: #777;
              margin-top: 20px;
              padding: 10px;
              background: #f5f5f5;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📱 아침활동 AI 코스웨어</h1>
            <p>태블릿 카메라로 QR 코드를 비추어 접속하세요!</p>
            <img src="${qrDataUrl}" alt="접속 QR코드" />
            <div class="url">${shareUrl}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          color: '#111827',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '440px',
          padding: '28px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: '1px solid #E5E7EB'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
            color: '#6B7280',
            padding: '4px',
            borderRadius: '6px'
          }}
          aria-label="닫기"
        >
          ✕
        </button>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(6, 78, 59, 0.1)',
              color: 'var(--color-point, #064e3b)',
              fontSize: '1.4rem',
              marginBottom: '10px'
            }}
          >
            📱
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px 0', color: '#111827' }}>
            학생 접속용 QR 코드
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: 0 }}>
            선생님이 설정하신 DB 및 API 설정이 포함되어 있습니다.
          </p>
        </div>

        {/* 안내 배지 */}
        {!hasConfig && (
          <div
            style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #F59E0B',
              color: '#92400E',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              marginBottom: '14px',
              textAlign: 'center',
              width: '100%'
            }}
          >
            ⚠️ 아직 정식 Firebase 설정이 없습니다. 기본 주소로 QR코드가 생성되었습니다.
          </div>
        )}

        {/* QR 코드 이미지 컨테이너 (흰색 바탕 및 테두리/그림자) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '12px',
            borderRadius: '12px',
            border: '2px solid #111827',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '260px',
            width: '260px'
          }}
        >
          {loading ? (
            <div style={{ fontSize: '0.88rem', color: '#6B7280', fontWeight: 600 }}>
              QR 코드 생성 중...
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="학생 접속용 QR 코드"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          ) : (
            <div style={{ fontSize: '0.88rem', color: '#EF4444' }}>
              QR 코드를 불러오지 못했습니다.
            </div>
          )}
        </div>

        {/* 학생 접속 안내 가이드 */}
        <div
          style={{
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '10px',
            padding: '10px 14px',
            width: '100%',
            marginBottom: '16px',
            fontSize: '0.82rem',
            color: '#374151',
            lineHeight: 1.45,
            textAlign: 'center'
          }}
        >
          💡 <strong>학생 태블릿 카메라</strong>로 위 QR코드를 비추면<br />
          별도의 복잡한 설정 없이 <strong>선생님의 학급 문제 화면</strong>으로 바로 연결됩니다!
        </div>

        {/* 작업 버튼 그룹 */}
        <div style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: '10px' }}>
          <button
            onClick={handleCopyLink}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: copySuccess ? '#10B981' : '#111827',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {copySuccess ? '✓ 복사 완료!' : '📋 링크 복사'}
          </button>
          <button
            onClick={handleDownloadQR}
            disabled={!qrDataUrl}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              color: '#111827',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              cursor: qrDataUrl ? 'pointer' : 'not-allowed'
            }}
          >
            💾 이미지 저장
          </button>
          <button
            onClick={handlePrint}
            disabled={!qrDataUrl}
            style={{
              padding: '10px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              color: 'var(--color-point, #064e3b)',
              border: '1px solid var(--color-point, #064e3b)',
              borderRadius: '8px',
              cursor: qrDataUrl ? 'pointer' : 'not-allowed'
            }}
          >
            🖨️ 인쇄
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '0.82rem',
            color: '#6B7280',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
};
