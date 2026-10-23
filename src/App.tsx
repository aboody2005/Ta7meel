// =============================================
// Main App Component
// =============================================

import { useState } from 'react';
import { Menu, GraduationCap, Globe } from 'lucide-react';
import { useApp } from './context/AppContext';
import { translations } from './i18n/translations';
import Sidebar from './components/Sidebar';
import FileUpload from './components/FileUpload';
import ValidationScreen from './components/ValidationScreen';
import Dashboard from './components/Dashboard';
import StageView from './components/StageView';
import SubjectExplorer from './components/SubjectExplorer';
import ExportReports from './components/ExportReports';
import SubjectStageAssigner from './components/SubjectStageAssigner';
import SubjectCourseAssigner from './components/SubjectCourseAssigner';

function AppContent() {
  const { language, setLanguage, activeView, parsedData, validationAccepted, rawBuffer } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAr = language === 'ar';
  const t = translations[language];

  // Determine what to render in main area
  const renderMain = () => {
    // No file uploaded at all
    if (!rawBuffer && !parsedData) {
      return <FileUpload />;
    }

    // File uploaded, show validation first
    if (parsedData && !validationAccepted) {
      return <ValidationScreen />;
    }

    // Navigation-based views
    switch (activeView) {
      case 'dashboard':
        return parsedData ? <Dashboard /> : <FileUpload />;
      case 'stage':
        return parsedData ? <StageView /> : <FileUpload />;
      case 'subject-explorer':
        return parsedData ? <SubjectExplorer /> : <FileUpload />;
      case 'assign-stages':
        return parsedData ? <SubjectStageAssigner /> : <FileUpload />;
      case 'assign-courses':
        return parsedData ? <SubjectCourseAssigner /> : <FileUpload />;
      case 'export':
        return parsedData ? <ExportReports /> : <FileUpload />;
      case 'validation':
        return parsedData ? <ValidationScreen /> : <FileUpload />;
      default:
        return <FileUpload />;
    }
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex flex-col lg:flex-row min-h-screen bg-slate-50 w-full max-w-[100vw] overflow-x-hidden"
      lang={isAr ? 'ar' : 'en'}
    >
      {/* Mobile Navigation Header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="p-2 -m-1 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[42px] min-h-[42px] flex items-center justify-center cursor-pointer"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={isAr ? 'فتح القائمة الرئيسية' : 'Open main navigation'}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 text-white shadow-2xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 text-xs sm:text-sm leading-tight block truncate">
                {t.appName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-xs px-2.5 py-1 font-bold text-slate-600 hover:bg-slate-100 min-h-[36px]"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5 me-1" />
            <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <Sidebar
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 w-full overflow-y-auto">
        {renderMain()}
      </main>
    </div>
  );
}

export default function App() {
  // AppProvider is in main.tsx
  return <AppContent />;
}
