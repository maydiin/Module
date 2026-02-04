import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import ModulesPage from './pages/ModulesPage';
import ModuleFieldsPage from './pages/ModuleFieldsPage';
import ModuleRecordsPage from './pages/ModuleRecordsPage';

function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<ModulesPage />} />
          <Route path="/modules/:moduleId/fields" element={<ModuleFieldsPage />} />
          <Route path="/modules/:moduleId/records" element={<ModuleRecordsPage />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;

