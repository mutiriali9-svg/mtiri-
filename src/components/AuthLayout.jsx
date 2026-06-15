import React from "react";

const styles = `
  @keyframes mt-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  @keyframes mt-spin { to{transform:rotate(360deg)} }
  @keyframes mt-glow { 0%,100%{opacity:.5;transform:scale(.96)} 50%{opacity:.9;transform:scale(1.06)} }
  @keyframes mt-aurora { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(3%,-3%) scale(1.08)} }
  input { color: #EEF2F8 !important; font-weight: 500 !important; }
  input::placeholder { color: #f3f5fb !important; }
`;

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <>
      <style>{styles}</style>
      <div style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '52px 22px',
        overflow: 'hidden',
        background: 'radial-gradient(125% 110% at 50% 26%, #1b2433 0%, #121c30 46%, #0a1426 100%)',
        color: '#EEF2F8',
      }}>

        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)',
          backgroundSize: '56px 56px',
          WebkitMask: 'radial-gradient(72% 64% at 50% 36%,#000 0%,transparent 78%)',
          mask: 'radial-gradient(72% 64% at 50% 36%,#000 0%,transparent 78%)',
          pointerEvents: 'none',
        }} />

        {/* Gold glow top */}
        <div style={{
          position: 'absolute', top: '-14%', left: '50%', transform: 'translateX(-50%)',
          width: 680, height: 680, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(201,155,63,.18) 0%,rgba(201,155,63,0) 62%)',
          filter: 'blur(20px)',
          animation: 'mt-aurora 12s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Blue glow bottom */}
        <div style={{
          position: 'absolute', bottom: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: 620, height: 620, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(46,76,140,.32) 0%,rgba(46,76,140,0) 66%)',
          filter: 'blur(34px)',
          animation: 'mt-aurora 16s ease-in-out infinite reverse',
          pointerEvents: 'none',
        }} />

        {/* Outer ring */}
        <div style={{
          position: 'absolute', top: '34%', left: '50%',
          width: 720, height: 720, margin: '-360px 0 0 -360px',
          borderRadius: '50%', border: '1px solid rgba(201,155,63,.08)',
          pointerEvents: 'none',
        }} />

        {/* Spinning dashed ring */}
        <div style={{
          position: 'absolute', top: '34%', left: '50%',
          width: 540, height: 540, margin: '-270px 0 0 -270px',
          borderRadius: '50%', border: '1px dashed rgba(255,255,255,.06)',
          animation: 'mt-spin 80s linear infinite',
          pointerEvents: 'none',
        }} />

        {/* Card */}
        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 420 }}>

          {/* Logo */}
          <div style={{ position: 'relative', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', inset: '-14% -8%', borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(201,155,63,.3) 0%,rgba(201,155,63,0) 66%)',
              filter: 'blur(9px)',
              animation: 'mt-glow 5s ease-in-out infinite',
            }} />
            <img
              src="https://hhgedebikuqdxzacqxqn.supabase.co/storage/v1/object/public/mtiri/emblem-feathered.png"
              alt="المطيري"
              style={{
                position: 'relative',
                width: 'min(120px, 30vw)',
                height: 'auto',
                display: 'block',
                animation: 'mt-float 7s ease-in-out infinite',
                filter: 'drop-shadow(0 18px 42px rgba(0,0,0,.5))',
              }}
            />
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#F4F7FB' }}>{title}</h1>
            {subtitle && <p style={{ margin: 0, fontSize: 14, color: '#9aa5b8' }}>{subtitle}</p>}
          </div>

          {/* Content box */}
          <div style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.10)',
            borderRadius: 20,
            padding: '28px 28px',
            backdropFilter: 'blur(12px)',
          }}>
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <p style={{ textAlign: 'center', fontSize: 13, marginTop: 20, color: 'rgba(255,255,255,.6)' }}>
              {footer}
            </p>
          )}
        </div>
      </div>
    </>
  );
}