import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { verifyEmail, resendVerificationCode } from '../services/api';

function EmailVerificationPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState(location.state?.email || '');
    const [verificationCode, setVerificationCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await verifyEmail(email, verificationCode);
            setSuccess(t('verification_success'));
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || t('verification_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError('');
        setSuccess('');
        setResendLoading(true);

        try {
            await resendVerificationCode(email);
            setSuccess(t('new_code_sent'));
            setResendCooldown(60);
        } catch (err) {
            setError(err.response?.data?.error || t('code_send_failed'));
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-5">
                    <div className="card shadow border-0">
                        <div className="card-body p-5">
                            <h2 className="text-center mb-4">{t('email_verification_title')}</h2>

                            <p className="text-muted text-center mb-4">
                                {t('email_verification_desc')}
                            </p>

                            {error && <div className="alert alert-danger">{error}</div>}
                            {success && <div className="alert alert-success">{success}</div>}

                            <form onSubmit={handleVerify}>
                                <div className="mb-3">
                                    <label className="form-label">{t('email')}</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="form-label">{t('verification_code')}</label>
                                    <input
                                        type="text"
                                        className="form-control text-center"
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="000000"
                                        maxLength="6"
                                        required
                                        style={{ fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary w-100 py-2 mb-3"
                                    disabled={loading || verificationCode.length !== 6}
                                >
                                    {loading ? t('verifying') : t('verify')}
                                </button>
                            </form>

                            <div className="text-center">
                                <button
                                    type="button"
                                    className="btn btn-link text-decoration-none"
                                    onClick={handleResend}
                                    disabled={resendLoading || resendCooldown > 0}
                                >
                                    {resendLoading ? t('resending') :
                                        resendCooldown > 0 ? t('resend_code_cooldown', { seconds: resendCooldown }) :
                                            t('resend_code')}
                                </button>
                            </div>

                            <div className="text-center mt-3">
                                <a href="/login" className="text-decoration-none text-muted">
                                    {t('back_to_login')}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EmailVerificationPage;
