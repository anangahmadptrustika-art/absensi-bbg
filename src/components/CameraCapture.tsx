'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  title: string;
  /** Warna tombol kirim, mis. 'bg-green-600' / 'bg-orange-500' */
  accentClass: string;
  sending: boolean;
  onConfirm: (photoDataUrl: string) => void;
  onCancel: () => void;
}

/**
 * Layar kamera selfie satu-langkah untuk absen:
 * kamera depan → AMBIL FOTO → pratinjau → KIRIM / ULANGI.
 */
export default function CameraCapture({ title, accentClass, sending, onConfirm, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhoto(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError(
        'Kamera tidak bisa dibuka. Izinkan akses kamera di pengaturan HP Anda, lalu coba lagi.'
      );
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return stopStream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError('Kamera belum siap. Tunggu sebentar lalu coba lagi.');
      return;
    }
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // cerminkan agar hasil sama dengan yang dilihat di layar
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL('image/jpeg', 0.8));
    stopStream();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="bg-black/80 px-4 py-4 text-center">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-base text-gray-300">Posisikan wajah Anda di dalam bingkai</p>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Pratinjau selfie" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
        )}
        {!photo && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-72 w-56 rounded-[50%] border-4 border-dashed border-white/70" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6">
            <p className="text-center text-xl font-semibold text-white">{error}</p>
          </div>
        )}
      </div>

      <div className="space-y-3 bg-black/80 p-4 pb-8">
        {photo ? (
          <>
            <button
              className={`btn-huge ${accentClass}`}
              disabled={sending}
              onClick={() => onConfirm(photo)}
            >
              {sending ? 'MENGIRIM…' : '✔ KIRIM ABSEN'}
            </button>
            <button
              className="btn-huge bg-gray-600"
              disabled={sending}
              onClick={startCamera}
            >
              ↺ FOTO ULANG
            </button>
          </>
        ) : (
          <button className="btn-huge bg-white !text-gray-900" onClick={takePhoto} disabled={!!error}>
            📷 AMBIL FOTO
          </button>
        )}
        <button
          className="w-full py-3 text-center text-lg font-semibold text-gray-300"
          disabled={sending}
          onClick={() => {
            stopStream();
            onCancel();
          }}
        >
          Batal — kembali
        </button>
      </div>
    </div>
  );
}
