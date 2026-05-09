import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { register } from '../services/api';

function RegisterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const validateForm = () => {
        const newErrors = {};

        if (formData.username.length < 3) {
            newErrors.username = t('username_min_length');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            newErrors.email = t('email_invalid');
        }

        if (formData.password.length < 6) {
            newErrors.password = t('password_min_length');
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = t('passwords_not_match');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setErrors({});

        try {
            await register(formData.username, formData.email, formData.password);
            navigate('/verify-email', { state: { email: formData.email } });
        } catch (err) {
            setErrors({
                submit: err.response?.data?.error || t('register_failed')
            });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error for this field if it exists
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: undefined
            }));
        }
    };

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center py-5 px-3" 
             style={{ 
                 background: 'radial-gradient(circle at top right, hsl(var(--primary) / 0.05), transparent), radial-gradient(circle at bottom left, hsl(var(--secondary) / 0.05), transparent)',
                 backgroundColor: 'hsl(var(--background))'
             }}>
            <div className="w-100" style={{ maxWidth: '500px' }}>
                <div className="text-center mb-5 fade-in">
                    <div className="w-auto d-inline-flex p-0 mb-4 fade-in">
                        <Icon name="box" size={64} className="icon-theme" />
                    </div>
                    <h1 className="display-5 fw-800 mb-2">
                        <span className="text-gradient">{t('app_name')}</span>
                    </h1>
                    <p className="text-muted lead px-4 fw-medium opacity-80">{t('register_subtitle')}</p>
                </div>

                <div className="card shadow-premium border-0 overflow-hidden fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="card-body p-4 p-lg-5">
                        <h2 className="fw-extrabold mb-4 fs-3">{t('register_title')}</h2>

                        {errors.submit && (
                            <div className="alert alert-danger glass border-danger border-opacity-25 mb-4 py-3 shadow-sm d-flex align-items-center">
                                <span className="me-2 fs-5">⚠️</span>
                                <span className="small fw-medium">{errors.submit}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label small fw-bold text-primary text-uppercase tracking-wider">{t('username')}</label>
                                <input
                                    type="text"
                                    name="username"
                                    className={`form-control form-control-lg border-2 ${errors.username ? 'is-invalid' : ''}`}
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder={t('username_placeholder')}
                                    required
                                />
                                {errors.username && (
                                    <div className="invalid-feedback small fw-bold">{errors.username}</div>
                                )}
                            </div>

                            <div className="mb-3">
                                <label className="form-label small fw-bold text-primary text-uppercase tracking-wider">{t('email')}</label>
                                <input
                                    type="email"
                                    name="email"
                                    className={`form-control form-control-lg border-2 ${errors.email ? 'is-invalid' : ''}`}
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder={t('email_placeholder')}
                                    required
                                />
                                {errors.email && (
                                    <div className="invalid-feedback small fw-bold">{errors.email}</div>
                                )}
                            </div>

                            <div className="mb-3">
                                <label className="form-label small fw-bold text-primary text-uppercase tracking-wider">{t('password')}</label>
                                <input
                                    type="password"
                                    name="password"
                                    className={`form-control form-control-lg border-2 ${errors.password ? 'is-invalid' : ''}`}
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder={t('password_placeholder')}
                                    required
                                />
                                {errors.password && (
                                    <div className="invalid-feedback small fw-bold">{errors.password}</div>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="form-label small fw-bold text-primary text-uppercase tracking-wider">{t('confirm_password')}</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    className={`form-control form-control-lg border-2 ${errors.confirmPassword ? 'is-invalid' : ''}`}
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder={t('confirm_password_placeholder')}
                                    required
                                />
                                {errors.confirmPassword && (
                                    <div className="invalid-feedback small fw-bold">{errors.confirmPassword}</div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary w-100 py-3 mb-4 shadow-md hover-lift fw-bold"
                                disabled={loading}
                            >
                                {loading ? t('registering') : t('register_button')}
                            </button>

                            <div className="text-center pt-2">
                                <span className="text-nav small">{t('already_have_account')} </span>
                                <a href="/login" className="text-primary fw-bold text-decoration-none small hover-underline">{t('login_now')}</a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;
