import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../components/ThemeContext';
import Icon from '../components/Icon';

function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="fade-in">
      <div className="d-flex align-items-center mb-4 mb-md-5">
        <div className="bg-primary bg-opacity-10 p-2 p-md-3 rounded-4 me-3 me-md-4 shadow-sm d-flex align-items-center justify-content-center">
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
              <div className="bg-primary p-2 rounded-3 me-3 text-white shadow-sm d-flex align-items-center justify-content-center">
                <Icon name="box" size={24} color="white" />
              </div>
              <h3 className="mb-0">{t('appearance', 'Görünüm')}</h3>
            </div>

            <div className="mb-5">
              <label className="form-label fw-bold mb-3 d-flex align-items-center">
                <span>{t('color_scale', 'Renk Skalası')}</span>
                <span className="badge bg-primary bg-opacity-10 text-primary ms-2 px-2 py-1" style={{ fontSize: '0.6rem', textTransform: 'uppercase' }}>{themes.find(t => t.id === theme)?.label}</span>
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

            <div className="p-4 rounded-4 bg-primary bg-opacity-5 border border-primary border-opacity-10">
              <div className="d-flex align-items-start gap-3">
                <div className="bg-primary bg-opacity-10 p-2 rounded-3">
                  <Icon name="lightbulb" size={24} className="icon-theme" />
                </div>
                <div>
                  <h6 className="fw-bold mb-1">{t('pro_tip', 'İpucu')}</h6>
                  <p className="small text-muted mb-0 opacity-80">
                    Seçtiğiniz tema tüm cihazlarınızda yerel olarak saklanır. Gelecekte karanlık mod ve yazı tipi özelleştirmeleri de eklenecektir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar for future settings info */}
        <div className="col-12 col-xl-4">
          <div className="glass-card p-5 h-100 bg-opacity-10">
            <h4 className="mb-4">{t('upcoming_features', 'Yakında Gelecekler')}</h4>
            <div className="d-flex flex-column gap-4">
              <div className="d-flex align-items-center gap-3 opacity-50 grayscale">
                <div className="bg-secondary p-2 rounded-3 text-white d-flex align-items-center justify-content-center">
                  <Icon name="moon" size={20} color="white" />
                </div>
                <div>
                  <div className="fw-bold small">Karanlık Mod</div>
                  <div className="text-muted extra-small">Göz yorgunluğunu azaltın (Planlanıyor)</div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-3 opacity-50 grayscale">
                <div className="bg-secondary p-2 rounded-3 text-white d-flex align-items-center justify-content-center">
                  <Icon name="globe" size={20} color="white" />
                </div>
                <div>
                  <div className="fw-bold small">Dil Ayarları</div>
                  <div className="text-muted extra-small">Çoklu dil desteği yönetimi</div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-3 opacity-50 grayscale">
                <div className="bg-secondary p-2 rounded-3 text-white d-flex align-items-center justify-content-center">
                  <Icon name="bell" size={20} color="white" />
                </div>
                <div>
                  <div className="fw-bold small">Bildirimler</div>
                  <div className="text-muted extra-small">Sistem bildirim tercihleri</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .extra-small { font-size: 0.75rem; }
        .grayscale { filter: grayscale(1); }
      `}</style>
    </div>
  );
}

export default SettingsPage;
