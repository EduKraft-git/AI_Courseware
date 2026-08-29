import React, { useState, useEffect } from 'react';
import { loadAppConfig, saveAppConfig, clearAppConfig, CustomFirebaseConfig } from '../config/appConfig';
import { parseFirebaseConfigText } from '../utils/configParser';
import { testGeminiApiKey, testFirebaseConnection } from '../services/dynamicFirebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onConfigUpdated }) => {
  const [config, setConfig] = useState(loadAppConfig());
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [rawFirebaseText, setRawFirebaseText] = useState('');
  const [parsedFbConfig, setParsedFbConfig] = useState<CustomFirebaseConfig | null>(null);

  const [testingStatus, setTestingStatus] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = loadAppConfig();
      setConfig(current);
      setGeminiKey(current.geminiApiKey || '');
      if (current.firebaseConfig) {
        setParsedFbConfig(current.firebaseConfig);
        setRawFirebaseText(JSON.stringify(current.firebaseConfig, null, 2));
      }
      setTestingStatus(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFirebaseTextChange = (text: string) => {
    setRawFirebaseText(text);
    const parsed = parseFirebaseConfigText(text);
    if (parsed) {
      setParsedFbConfig(parsed);
    }
  };

  const handleTestAll = async () => {
    setTestingStatus('연결 테스트 중...');
    if (geminiKey) {
      const gRes = await testGeminiApiKey(geminiKey);
      if (!gRes.success) {
        setTestingStatus(`Gemini 오류: ${gRes.message}`);
        return;
      }
    }

    if (parsedFbConfig) {
      const fRes = await testFirebaseConnection(parsedFbConfig);
      if (!fRes.success) {
        setTestingStatus(`Firebase 오류: ${fRes.message}`);
        return;
      }
    }

    setTestingStatus('모든 연결이 정상 작동합니다.');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedFbConfig) {
      alert('유효한 Firebase 설정이 필요합니다.');
      return;
    }
    saveAppConfig(geminiKey, parsedFbConfig, config.adminEmail);
    setSaveSuccess(true);
    setTimeout(() => {
      onConfigUpdated();
      onClose();
    }, 1000);
  };

  const handleReset = () => {
    if (window.confirm('저장된 API 키와 Firebase 설정을 모두 초기화하시겠습니까?')) {
      clearAppConfig();
      onConfigUpdated();
      onClose();
      window.location.reload();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        maxWidth: '560px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #E2E8F0',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FAFAFA',
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
            환경 설정 (API 및 DB 관리)
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#64748B',
            }}
          >
            ✕
          </button>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
              Gemini API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AQ... 또는 발급받은 Gemini 키"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: '#64748B',
                }}
              >
                {showGeminiKey ? '숨김' : '보기'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
              Firebase SDK Config
            </label>
            <textarea
              rows={6}
              value={rawFirebaseText}
              onChange={(e) => handleFirebaseTextChange(e.target.value)}
              placeholder={`// Import the functions you need from the SDKs you need\nimport { initializeApp } from "firebase/app";\n\n// Your web app's Firebase configuration\nconst firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-school.firebaseapp.com",\n  projectId: "my-school",\n  storageBucket: "my-school.firebasestorage.app",\n  messagingSenderId: "123456789",\n  appId: "1:123456:web:abcd"\n};\n\n// Initialize Firebase\nconst app = initializeApp(firebaseConfig);`}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
                lineHeight: '1.4',
              }}
            />
          </div>

          {parsedFbConfig && (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-point, #064e3b)', fontWeight: 600 }}>
              연동된 프로젝트 ID: {parsedFbConfig.projectId}
            </div>
          )}

          {testingStatus && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              backgroundColor: testingStatus.includes('오류') ? '#FEF2F2' : '#ECFDF5',
              color: testingStatus.includes('오류') ? '#991B1B' : '#065F46',
            }}>
              {testingStatus}
            </div>
          )}

          {saveSuccess && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              fontWeight: 600,
            }}>
              설정이 안전하게 저장되었습니다.
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '12px' }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                backgroundColor: '#FEF2F2',
                color: '#EF4444',
                border: '1px solid #FECACA',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              설정 초기화
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleTestAll}
                style={{
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                연결 테스트
              </button>
              <button
                type="submit"
                style={{
                  backgroundColor: 'var(--color-point, #064e3b)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                저장하기
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
