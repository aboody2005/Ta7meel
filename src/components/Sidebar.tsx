// =============================================
// Sidebar Navigation Component
// =============================================

import React, { useState } from 'react';
import {
  LayoutDashboard, GraduationCap, BookOpen, BookmarkCheck,
  Download, ShieldCheck, Upload, RotateCcw, Globe, AlertTriangle, Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n/translations';
import type { ActiveView } from '../types';

interface NavItem {
  view: ActiveView | 'upload';
  icon: React.ReactNode;
  labelKey: string;
  requiresData?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', icon: <LayoutDashboard className="w-5 h-5" />, labelKey: 'dashboard', requiresData: true },
  { view: 'stage', icon: <GraduationCap className="w-5 h-5" />, labelKey: 'stages', requiresData: true },
  { view: 'subject-explorer', icon: <BookOpen className="w-5 h-5" />, labelKey: 'subjectExplorer', requiresData: true },
  { view: 'assign-stages', icon: <BookmarkCheck className="w-5 h-5" />, labelKey: 'assignSubjectStages', requiresData: true },
  { view: 'assign-courses', icon: <Layers className="w-5 h-5" />, labelKey: 'subjectCourseAssignment', requiresData: true },
  { view: 'export', icon: <Download className="w-5 h-5" />, labelKey: 'exportReports', requiresData: true },
  { view: 'validation', icon: <ShieldCheck className="w-5 h-5" />, labelKey: 'validation', requiresData: true },
];

export default function Sidebar() {
  const {
    language, setLanguage, activeView, setActiveView,
    parsedData, resetSession, fileName, hasUnsavedChanges,
    setHasUnsavedChanges, hasUnsavedCourseChanges, setHasUnsavedCourseChanges
  } = useApp();
  const t = translations[language];
  const isAr = language === 'ar';

  const [pendingNav, setPendingNav] = useState<NavItem['view'] | null>(null);

  const executeNav = (view: NavItem['view']) => {
    if (view === 'upload') {
      resetSession();
    } else {
      setActiveView(view as ActiveView);
    }
  };

  const handleNav = (view: NavItem['view']) => {
    if (activeView === 'assign-stages' && view !== 'assign-stages' && hasUnsavedChanges) {
      setPendingNav(view);
      return;
    }
    if (activeView === 'assign-courses' && view !== 'assign-courses' && hasUnsavedCourseChanges) {
      setPendingNav(view);
      return;
    }
    executeNav(view);
  };

  const confirmDiscardAndProceed = () => {
    setHasUnsavedChanges(false);
    setHasUnsavedCourseChanges(false);
    if (pendingNav) {
      executeNav(pendingNav);
      setPendingNav(null);
    }
  };

  const cancelNavigation = () => {
    setPendingNav(null);
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm leading-tight">{t.appName}</p>
            <p className="text-xs text-slate-400 leading-tight mt-0.5 truncate">
              {isAr ? 'كلية الصيدلة' : 'College of Pharmacy'}
            </p>
          </div>
        </div>
      </div>

      {/* File info */}
      {fileName && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
          <p className="text-xs text-green-700 font-semibold truncate">{fileName}</p>
          <p className="text-xs text-green-600 mt-0.5">
            {parsedData?.includedStudents.length} {t.studentsCount} ({t.includedBadge})
            {parsedData && parsedData.excludedStudents.length > 0 && (
              <span className="text-rose-600 font-medium ms-1">
                • {parsedData.excludedStudents.length} {t.excludedBadge}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Nav items */}
      <nav className="p-3 flex-1 space-y-1 mt-1">
        {NAV_ITEMS.map(item => {
          const isDisabled = item.requiresData && !parsedData;
          return (
            <button
              key={item.view}
              className={`nav-link w-full ${activeView === item.view ? 'active' : ''} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              onClick={() => !isDisabled && handleNav(item.view)}
              disabled={isDisabled}
            >
              {item.icon}
              <span>{t[item.labelKey as keyof typeof t]}</span>
            </button>
          );
        })}

        <div className="divider" />

        {/* Upload another */}
        <button
          className="nav-link w-full"
          onClick={() => handleNav('upload')}
        >
          <Upload className="w-5 h-5" />
          <span>{t.uploadFile}</span>
        </button>

        {/* Reset */}
        {parsedData && (
          <button
            className="nav-link w-full text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={resetSession}
          >
            <RotateCcw className="w-5 h-5" />
            <span>{t.resetSession}</span>
          </button>
        )}
      </nav>

      {/* Language switcher */}
      <div className="p-3 border-t border-slate-100">
        <button
          className="nav-link w-full justify-between"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        >
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
          </div>
          <span className="text-xs text-slate-400 font-mono uppercase">{language === 'ar' ? 'EN' : 'AR'}</span>
        </button>
      </div>

      {/* Unsaved Changes Warning Modal */}
      {pendingNav && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 rounded-xl bg-amber-50">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t.unsavedChangesTitle}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t.unsavedChangesWarning}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs text-slate-600 font-semibold"
                onClick={cancelNavigation}
              >
                {t.stayAndSave}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border-red-200"
                onClick={confirmDiscardAndProceed}
              >
                {t.discardAndLeave}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
