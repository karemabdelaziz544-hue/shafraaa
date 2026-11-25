'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScannerModal({ isOpen, onClose, onScan }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    let html5QrCode: any = null;

    if (isOpen) {
      setError(null);
      import('html5-qrcode')
        .then(({ Html5Qrcode }) => {
          html5QrCode = new Html5Qrcode('barcode-reader');
          scannerRef.current = html5QrCode;

          const config = {
            fps: 10,
            qrbox: { width: 250, height: 180 },
            aspectRatio: 1.333,
          };

          html5QrCode
            .start(
              { facingMode: 'environment' },
              config,
              (decodedText: string) => {
                if (decodedText) {
                  onScan(decodedText.trim());
                  onClose();
                }
              },
              () => {
                // خطأ إطارات عادي أثناء البحث
              }
            )
            .catch((err: any) => {
              console.warn('Camera scan error:', err);
              setError('تعذر فتح الكاميرا (يرجى منح الإذن أو إدخال الباركود يدويًا)');
            });
        })
        .catch(() => {
          setError('تعذر تحميل مكتبة المسح');
        });
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
          });
      }
    };
  }, [isOpen, onScan, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="مسح باركود المنتج بالكاميرا" maxWidth="md">
      <div className="space-y-4 text-center">
        <div className="relative mx-auto rounded-2xl overflow-hidden bg-abyssal aspect-video flex items-center justify-center border-2 border-flame">
          <div id="barcode-reader" className="w-full h-full" />
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="w-64 h-36 border-2 border-dashed border-flame rounded-lg animate-pulse motion-reduce:animate-none" />
            <p className="text-palladian text-xs mt-2 bg-abyssal/85 px-2.5 py-1 rounded-lg border border-flame/40">
              وجه الكاميرا نحو باركود الصنف
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-warning-bg text-warning text-xs rounded-xl border border-warning-border font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-divider flex gap-2">
          <input
            type="text"
            placeholder="أو اكتب الباركود يدويًا واضغط إدخال..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 h-11 px-3 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame focus:ring-2 focus:ring-flame/25"
          />
          <Button type="submit" variant="primary" size="md">
            إدخال
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
