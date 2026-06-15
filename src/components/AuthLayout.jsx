import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '52px 22px',
      background: '#ffffff',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img
            src="https://hhgedebikuqdxzacqxqn.supabase.co/storage/v1/object/public/mtiri/emblem-feathered.png"
            alt="المطيري"
            style={{ width: 'min(120px, 30vw)', height: 'auto', display: 'block' }}
          />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#1B2B4B' }}>{title}</h1>
          {subtitle && <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{subtitle}</p>}
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 20,
          padding: '28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          {children}
        </div>

        {footer && (
          <p style={{ textAlign: 'center', fontSize: 13, marginTop: 20, color: '#6b7280' }}>
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}