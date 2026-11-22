import {APIProvider} from '@vis.gl/react-google-maps';
import {useEffect, useMemo, useState} from 'react';
import {DroneWorldViewport} from './components/DroneWorldViewport';
import {ErrorBoundary} from './components/ErrorBoundary';

const MAPS_LIBRARIES = ['maps3d', 'places', 'elevation'];

function checkWebGL2Support(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const hasWebGL2 = useMemo(() => checkWebGL2Support(), []);

  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    (typeof __GMP_API_KEY__ !== 'undefined' ? __GMP_API_KEY__ : '');

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  if (!apiKey) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
        <div className="max-w-md rounded-xl border border-white/15 bg-slate-900 p-6 space-y-3">
          <h1 className="text-lg font-bold text-amber-400">
            مفتاح خرائط جوجل غير مهيأ
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            يرجى تفعيل خرائط جوجل من إعدادات المشروع لتشغيل الخريطة ثلاثية الأبعاد بالمقياس الواقعي.
          </p>
        </div>
      </div>
    );
  }

  if (!hasWebGL2) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
        <div className="max-w-md rounded-xl border border-white/15 bg-slate-900 p-6 space-y-3">
          <h1 className="text-lg font-bold text-amber-400">
            المتصفح لا يدعم WebGL2
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            تتطلب خريطة العالم ثلاثية الأبعاد ونموذج الدرون تفعيل تسريع الرسوميات WebGL2 في المتصفح.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      {quotaExceeded && (
        <div
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm"
          dir="ltr"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <ErrorBoundary>
        <APIProvider
          apiKey={apiKey}
          libraries={MAPS_LIBRARIES}
          language="ar"
          region="SA"
        >
          <DroneWorldViewport />
        </APIProvider>
      </ErrorBoundary>
    </div>
  );
}
