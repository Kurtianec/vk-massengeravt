'use client';

import { useEffect } from 'react';

export default function VkCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    const userId = params.get('user_id');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    const allowedOrigin = window.opener ? window.opener.location.origin : window.location.origin;

    if (accessToken) {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'vk-oauth-token', accessToken, expiresIn, userId },
          allowedOrigin
        );
      }
    } else if (error) {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'vk-oauth-error', error, errorDescription },
          allowedOrigin
        );
      }
    }

    const root = document.getElementById('callback-root');
    if (root) {
      if (accessToken) {
        root.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;background:#E7E8EC;">
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:16px;padding:32px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:360px;">
              <div style="width:48px;height:48px;border-radius:50%;background:#EFFDDE;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="#4FAE4E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <h2 style="color:#000;font-size:18px;margin:0 0 8px;">Авторизация успешна!</h2>
              <p style="color:#707579;font-size:14px;margin:0;">Токен получен. Это окно закроется автоматически.</p>
            </div>
          </div>
        `;
        setTimeout(() => window.close(), 2000);
      } else {
        root.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;background:#E7E8EC;">
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:16px;padding:32px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:360px;">
              <div style="width:48px;height:48px;border-radius:50%;background:#E5393522;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="#E53935" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <h2 style="color:#000;font-size:18px;margin:0 0 8px;">Ошибка авторизации</h2>
              <p style="color:#707579;font-size:14px;margin:0;">${errorDescription || error || 'Не удалось получить токен'}</p>
            </div>
          </div>
        `;
      }
    }
  }, []);

  return (
    <div id="callback-root" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif',
      background: '#E7E8EC'
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E0E0E0',
        borderRadius: '16px',
        padding: '32px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        maxWidth: '360px'
      }}>
        <svg className="animate-spin" style={{ margin: '0 auto 16px' }} width="32" height="32" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2AABEE" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="#2AABEE" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <p style={{ color: '#707579', fontSize: '14px' }}>Обработка авторизации...</p>
      </div>
    </div>
  );
}
