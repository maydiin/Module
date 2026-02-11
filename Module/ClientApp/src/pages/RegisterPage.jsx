import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../services/api';

function RegisterPage() {
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
            newErrors.username = 'Kullanıcı adı en az 3 karakter olmalıdır';
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            newErrors.email = 'Geçerli bir e-posta adresi giriniz';
        }

        if (formData.password.length < 6) {
            newErrors.password = 'Şifre en az 6 karakter olmalıdır';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Şifreler eşleşmiyor';
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
                submit: err.response?.data?.error || 'Kayıt işlemi başarısız oldu'
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
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-5">
                    <div className="card shadow border-0">
                        <div className="card-body p-5">
                            <h2 className="text-center mb-4">Kayıt Ol</h2>

                            {errors.submit && (
                                <div className="alert alert-danger">{errors.submit}</div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">Kullanıcı Adı</label>
                                    <input
                                        type="text"
                                        name="username"
                                        className={`form-control ${errors.username ? 'is-invalid' : ''}`}
                                        value={formData.username}
                                        onChange={handleChange}
                                        required
                                    />
                                    {errors.username && (
                                        <div className="invalid-feedback">{errors.username}</div>
                                    )}
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">E-posta Adresi</label>
                                    <input
                                        type="email"
                                        name="email"
                                        className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                    {errors.email && (
                                        <div className="invalid-feedback">{errors.email}</div>
                                    )}
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">Şifre</label>
                                    <input
                                        type="password"
                                        name="password"
                                        className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                    {errors.password && (
                                        <div className="invalid-feedback">{errors.password}</div>
                                    )}
                                </div>

                                <div className="mb-4">
                                    <label className="form-label">Şifre Tekrar</label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                    />
                                    {errors.confirmPassword && (
                                        <div className="invalid-feedback">{errors.confirmPassword}</div>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary w-100 py-2 mb-3"
                                    disabled={loading}
                                >
                                    {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
                                </button>

                                <div className="text-center">
                                    <span className="text-muted">Zaten hesabınız var mı? </span>
                                    <a href="/login" className="text-decoration-none">Giriş Yap</a>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;
