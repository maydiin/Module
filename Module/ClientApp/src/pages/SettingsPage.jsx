import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../components/ThemeContext';
import Icon from '../components/Icon';

function SettingsPage() {
   const { t, i18n } = useTranslation();
   const { theme, setTheme, themes, isDarkMode, toggleDarkMode } = useTheme();

   const languages = [
     { id: 'en', label: t('english', 'İngilizce'), icon: 'globe' },
     { id: 'tr', label: t('turkish', 'Türkçe'), icon: 'globe' }
   ];

   const currentLanguage = i18n.language.split('-')[0]; // Handle locales like 'en-US'

  return (
    <div className="fade-in">
      <div className="d-flex align-items-center mb-4 mb-md-5">
        <div className="text-primary p-2 p-md-3 me-3 me-md-4 d-flex align-items-center justify-content-center">
          <Icon name="settings" size={32} className="icon-theme" />
        </div>
        <div>
          <h1 className="mb-1">{t('settings', 'Ayarlar')}</h1>
          <p className="text-muted mb-0 fw-medium opacity-70 d-none d-sm-block">
            {t('settings_desc', 'Uygulama tercihlerini ve görünüm ayarlarını buradan yönetebilirsiniz.')}
          </p>
        </div>
      </div>

      <div className="row g-4">
        {/* Appearance Section */}
        <div className="col-12 col-xl-8">
          <div className="glass-card p-5 h-100">
            <div className="d-flex align-items-center mb-5">
              <div className="text-primary me-3 d-flex align-items-center justify-content-center">
                <Icon name="box" size={24} className="icon-theme" />
              </div>
              <h3 className="mb-0">{t('appearance', 'Görünüm')}</h3>
            </div>

            <div className="mb-5">
              <label className="form-label fw-bold mb-3 d-flex align-items-center">
                <span>{t('color_scale', 'Renk Skalası')}</span>
                <span className="badge badge-soft-primary ms-2 px-2 py-1" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>{themes.find(t => t.id === theme)?.label}</span>
              </label>
              
              <div className="d-flex flex-wrap gap-3 mt-2">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`btn p-0 border-0 rounded-4 transition-all position-relative overflow-hidden ${theme === t.id ? 'scale-110 shadow-lg ring-4 ring-primary ring-opacity-20' : 'opacity-60 hover-opacity-100 hover-lift shadow-sm'}`}
                    style={{
                      minWidth: 'clamp(120px, 20vw, 160px)',
                      background: 'hsla(var(--background), 0.5)',
                      height: 'clamp(140px, 15vw, 180px)'
                    }}
                  >
                    <div className="d-flex flex-column h-100">
                      {/* Scale Preview Header */}
                      <div className="flex-grow-1 p-3 d-flex align-items-center justify-content-center position-relative" style={{ backgroundColor: `hsl(${t.color} / 0.05)` }}>
                         <div className="d-flex gap-n1">
                            <div className="rounded-circle shadow-sm border border-2 border-white" style={{ width: '28px', height: '28px', backgroundColor: `hsl(${t.color})`, zIndex: 2 }} />
                            <div className="rounded-circle shadow-sm border border-2 border-white ms-n2" style={{ width: '28px', height: '28px', backgroundColor: `hsl(${t.id === 'default' ? '260 80% 65%' : t.color.replace('30%', '45%').replace('48%', '60%').replace('50%', '53%').replace('61%', '68%')})`, zIndex: 1 }} />
                         </div>
                         {theme === t.id && (
                            <div className="position-absolute top-0 end-0 p-2">
                              <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '18px', height: '18px' }}>
                                <Icon name="check" size={10} color="white" strokeWidth={4} />
                              </div>
                            </div>
                          )}
                      </div>
                      {/* Label Footer */}
                      <div className={`p-2 p-md-3 text-center fw-bold small ${theme === t.id ? 'bg-primary text-white' : 'bg-surface text-foreground'}`}>
                        {t.label}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5 pt-4 border-top border-primary border-opacity-10">
              <label className="form-label fw-bold mb-3 d-flex align-items-center">
                <span>{t('theme_mode', 'Tema Modu')}</span>
                <span className="badge badge-soft-primary ms-2 px-2 py-1" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                  {isDarkMode ? t('dark_mode', 'Karanlık') : t('light_mode', 'Aydınlık')}
                </span>
              </label>
              <div className="d-flex gap-3">
                <button
                  onClick={() => !isDarkMode && toggleDarkMode()}
                  className={`btn flex-grow-1 p-3 border-0 rounded-4 transition-all ${isDarkMode ? 'bg-primary text-white shadow-lg' : 'bg-surface hover-lift shadow-sm opacity-80'}`}
                >
                  <Icon name="moon" size={20} color={isDarkMode ? "white" : "currentColor"} />
                  <span>{t('dark_mode', 'Karanlık')}</span>
                </button>
                <button
                  onClick={() => isDarkMode && toggleDarkMode()}
                  className={`btn flex-grow-1 p-3 border-0 rounded-4 transition-all ${!isDarkMode ? 'bg-primary text-white shadow-lg' : 'bg-surface hover-lift shadow-sm opacity-80'}`}
                >
                  <Icon name="sun" size={20} color={!isDarkMode ? "white" : "currentColor"} />
                  <span>{t('light_mode', 'Aydınlık')}</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-4 bg-surface border border-theme-accent shadow-sm">
              <div className="d-flex align-items-start gap-3">
                <div className="text-primary">
                  <Icon name="lightbulb" size={24} className="icon-theme" />
                </div>
                <div>
                  <h6 className="fw-bold mb-1">{t('pro_tip', 'İpucu')}</h6>
                  <p className="small text-muted mb-0 opacity-80">
                    Seçtiğiniz tema ve mod tercihleri tüm cihazlarınızda yerel olarak saklanır.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Language Section */}
        <div className="col-12 col-xl-4">
          <div className="glass-card p-5 h-100">
            <div className="d-flex align-items-center mb-5">
              <div className="text-primary me-3 d-flex align-items-center justify-content-center">
                <Icon name="globe" size={24} className="icon-theme" />
              </div>
              <h3 className="mb-0">{t('language', 'Dil')}</h3>
            </div>

            <div className="mb-5">
              <label className="form-label fw-bold mb-3 d-flex align-items-center">
                <span>{t('select_language', 'Dil Seçimi')}</span>
                <span className="badge badge-soft-primary ms-2 px-2 py-1" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                  {languages.find(l => l.id === currentLanguage)?.label}
                </span>
              </label>
              
              <div className="d-flex flex-column gap-3 mt-2">
                {languages.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => i18n.changeLanguage(l.id)}
                    className={`btn d-flex align-items-center justify-content-between p-3 border-0 rounded-4 transition-all ${currentLanguage === l.id ? 'bg-primary text-white shadow-lg' : 'bg-surface hover-lift shadow-sm opacity-80'}`}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className={`p-2 rounded-3 ${currentLanguage === l.id ? 'bg-primary' : 'bg-surface border border-theme-accent'}`}>
                        <span className="fw-bold fs-7">{l.id.toUpperCase()}</span>
                      </div>
                      <span className="fw-bold">{l.label}</span>
                    </div>
                    {currentLanguage === l.id && (
                      <Icon name="check" size={18} color="white" strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-4 bg-surface border border-theme-accent mt-auto">
              <p className="small text-muted mb-0 opacity-80">
                {t('language_desc', 'Uygulama dilini buradan değiştirebilirsiniz.')}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default SettingsPage;
