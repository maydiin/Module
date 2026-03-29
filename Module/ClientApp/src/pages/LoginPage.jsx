import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useTranslation } from 'react-i18next';

function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center py-5 px-3" 
             style={{ 
                 background: 'radial-gradient(circle at top right, hsl(var(--primary) / 0.05), transparent), radial-gradient(circle at bottom left, hsl(var(--secondary) / 0.05), transparent)',
                 backgroundColor: 'hsl(var(--background))'
             }}>
            <div className="w-100" style={{ maxWidth: '440px' }}>
                <div className="text-center mb-5 fade-in">
                    <div className="fs-1 mb-3">📦</div>
                    <h1 className="display-5 fw-bold mb-2">
                        <span className="text-gradient">{t('app_name')}</span>
                    </h1>
                    <p className="text-muted lead px-4">{t('login_subtitle') || 'Sistem yönetimine hoş geldiniz.'}</p>
                </div>
                
                <div className="card shadow-premium border-0 overflow-hidden fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="card-body p-4 p-lg-5">
                        <h2 className="fw-bold mb-4 fs-3">Giriş Yap</h2>
                        {error && (
                            <div className="alert alert-danger glass border-danger border-opacity-25 mb-4 py-3 shadow-sm d-flex align-items-center">
                                <span className="me-2 fs-5">⚠️</span>
                                <span className="small fw-medium">{error}</span>
                            </div>
                        )}
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="form-label small fw-bold text-muted text-uppercase tracking-wider">Kullanıcı Adı</label>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        className="form-control form-control-lg border-2"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Kullanıcı adınızı girin"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="form-label small fw-bold text-muted text-uppercase tracking-wider">Şifre</label>
                                <input
                                    type="password"
                                    className="form-control form-control-lg border-2"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Şifrenizi girin"
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-100 py-3 mb-4 shadow-md hover-lift fw-bold" disabled={loading}>
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Giriş Yapılıyor...
                                    </>
                                ) : (
                                    'Sisteme Giriş Yap'
                                )}
                            </button>
                            <div className="text-center pt-2">
                                <span className="text-muted small">Hesabınız yok mu? </span>
                                <a href="/register" className="text-primary fw-bold text-decoration-none small hover-underline">Kayıt Olun</a>
                            </div>
                        </form>
                    </div>
                </div>
                <p className="text-center mt-5 text-muted small opacity-50">&copy; {new Date().getFullYear()} {t('footer_text')}</p>
            </div>
        </div>
    );
}

export default LoginPage;
