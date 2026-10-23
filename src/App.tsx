// =============================================
// Main App Component
// =============================================

import { useApp } from './context/AppContext';
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
  const { language, activeView, parsedData, validationAccepted, rawBuffer } = useApp();
  const isAr = language === 'ar';

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
      className="flex min-h-screen bg-slate-50"
      lang={isAr ? 'ar' : 'en'}
    >
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {renderMain()}
      </main>
    </div>
  );
}

export default function App() {
  // AppProvider is in main.tsx
  return <AppContent />;
}
