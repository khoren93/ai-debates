import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const Background = ({ accent }: { accent: string }) => {
  const frame = useCurrentFrame();
  const drift = (frame % 900) / 900;
  return (
    <AbsoluteFill style={{ background: '#0b1020' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(900px 600px at ${15 + drift * 10}% 10%, ${accent}33 0%, transparent 60%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 700px at 85% 90%, #f9731622 0%, transparent 60%)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
    </AbsoluteFill>
  );
};
