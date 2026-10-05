import React, { useState } from 'react';
import { adminApi } from '../../client/api';
import { Event } from '../../domain/types';
import { Download, FileJson, FileSpreadsheet, ShieldCheck, AlertCircle } from 'lucide-react';

interface ExportsViewProps {
  event: Event;
}

export const ExportsView: React.FC<ExportsViewProps> = ({ event }) => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportLongCsv = async () => {
    setDownloading('long-csv');
    setErrorMsg(null);
    try {
      const res = await adminApi.exportLongCsv(event.id);
      downloadFile(res.csv, res.filename, 'text/csv;charset=utf-8;');
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در دریافت فایل Long CSV.');
    } finally {
      setDownloading(null);
    }
  };

  const handleExportCoverageCsv = async () => {
    setDownloading('coverage-csv');
    setErrorMsg(null);
    try {
      const res = await adminApi.exportCoverageCsv(event.id);
      downloadFile(res.csv, res.filename, 'text/csv;charset=utf-8;');
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در دریافت فایل Coverage CSV.');
    } finally {
      setDownloading(null);
    }
  };

  const handleExportBundle = async () => {
    setDownloading('bundle');
    setErrorMsg(null);
    try {
      const res = await adminApi.exportAnalysisBundle(event.id);
      downloadFile(
        JSON.stringify(res.bundle, null, 2),
        res.filename,
        'application/json;charset=utf-8;'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در دریافت بسته تحلیلی JSON.');
    } finally {
      setDownloading(null);
    }
  };

  const isClosedOrArchived = event.status === 'Closed' || event.status === 'Archived';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-white">خروجی‌های داده دوره</h2>
        <p className="text-xs text-slate-400">
          دریافت فایل‌های استاندارد مشاهدات و پوشش داده با حفظ کامل حریم خصوصی و امنیت شواهد
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Privacy Guarantee Note */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <div className="font-bold text-white">ضمانت استاندارد حریم داده و استقلال ارزیابی:</div>
          هیچ‌کدام از خروجی‌های این سامانه شامل کلمات عبور، شماره‌های تماس، توکن‌های نشست یا نگاشت‌های پنهان شایستگی نیستند. داده‌ها در ساختار خام و با یک برچسب رفتار در هر سطر تحویل داده می‌شوند.
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Long CSV */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">فایل تفصیلی مشاهدات (Long CSV)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              UTF-8 با BOM مناسب Excel. به ازای هر تگ رفتار دقیقاً یک سطر با تمام متادیتا، وضعیت ثبت و شناسه مشاهده.
            </p>
            {!isClosedOrArchived && (
              <span className="inline-block text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-medium">
                توصیه: پس از پایان و بسته شدن دوره خروجی گرفته شود
              </span>
            )}
          </div>

          <button
            onClick={handleExportLongCsv}
            disabled={downloading !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloading === 'long-csv' ? 'در حال آماده‌سازی...' : 'دانلود Long CSV'}</span>
          </button>
        </div>

        {/* 2. Coverage CSV */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">ماتریس پوشش شواهد (Coverage CSV)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              یک ردیف برای هر فعالیت × فرد شامل تعداد مشاهدات، تسهیلگران ناظر، عدم فرصت و خلاصه پوشش.
            </p>
            <span className="inline-block text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-medium">
              در هر لحظه قابل دریافت است
            </span>
          </div>

          <button
            onClick={handleExportCoverageCsv}
            disabled={downloading !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloading === 'coverage-csv' ? 'در حال آماده‌سازی...' : 'دانلود Coverage CSV'}</span>
          </button>
        </div>

        {/* 3. Analysis Bundle JSON */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <FileJson className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">بسته تحلیلی جامع (Analysis Bundle)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              قالب استاندارد JSON شامل متادیتا، شرکت‌کنندگان، فعالیت‌ها، تخصیص‌ها و مشاهدات با کلید hidden_competency_mapping: null.
            </p>
            {!isClosedOrArchived && (
              <span className="inline-block text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-medium">
                توصیه: در وضعیت Closed دریافت شود
              </span>
            )}
          </div>

          <button
            onClick={handleExportBundle}
            disabled={downloading !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloading === 'bundle' ? 'در حال آماده‌سازی...' : 'دانلود Analysis JSON'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
