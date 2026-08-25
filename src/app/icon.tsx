import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #1e40af 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
          border: '4px solid #38bdf8',
          color: '#ffffff',
          fontWeight: 900,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 72, letterSpacing: -2, lineHeight: 1 }}>OB</div>
        <div style={{ fontSize: 18, letterSpacing: 3, opacity: 0.9, marginTop: 4 }}>OPENBON</div>
      </div>
    ),
    {
      ...size,
    }
  );
}
