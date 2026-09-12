import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrJoin({ url, size = 280 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: '#0B1020', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then((d) => {
      if (!cancelled) setDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: '#fff',
          borderRadius: 12,
        }}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={`QR code to join: ${url}`}
      style={{ borderRadius: 12, background: '#fff' }}
    />
  );
}
