import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ResetPasswordRequest() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const { resetPasswordRequest } = useAuth();
    

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        // Email validation
        if (!email.trim()) {
            setError("Email is required");
            return;
        }

        if (!validateEmail(email)) {
            setError("Please enter a valid email address");
            return;
        }

        setIsLoading(true);

        try {
            await resetPasswordRequest(email.trim());
            setSuccess(true);
            
            // Navigate to confirmation page after delay
            setTimeout(() => {
                navigate("/confirm-password", { state: { email: email.trim() } });
            }, 2000);
            
        } catch (err) {
            console.error('Password reset request error:', err);
            
            // Handle different types of errors
            if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else if (err.message) {
                setError(err.message);
            } else {
                setError("Failed to send reset request. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToLogin = () => {
        navigate('/login');
    };

    return (
        <div style={{width: '100%', height: '100vh', position: 'relative', background: '#F2F2F2', overflow: 'hidden'}}>
            {/* Decorative circles */}
            <div style={{width: 20, height: 20, left: 85, top: 432, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 20, height: 20, left: 222, top: 483, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 20, height: 20, left: 313, top: 378, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 20, height: 20, left: 1096, top: 200, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 20, height: 20, left: 1322, top: 180, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 20, height: 20, left: 1254, top: 32, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 20, height: 20, left: 1386, top: 950, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 20, height: 20, left: 1008, top: 910, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 20, height: 20, left: 1188, top: 728, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 159, top: 282, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 272, top: 755, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 1013, top: 52, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 1386, top: 102, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 1193, top: 297, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 36, top: 641, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 1066, top: 785, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 1264, top: 940, position: 'absolute', background: 'white', borderRadius: 9999}} />
            <div style={{width: 30, height: 30, left: 1342, top: 649, position: 'absolute', background: 'white', borderRadius: 9999}} />

            {/* Main content card */}
            <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="w-full max-w-md" style={{background: 'rgba(255, 255, 255, 0.10)', backdropFilter: 'blur(10px)', borderRadius: 20, border: '1px solid rgba(177, 184, 220, 0.60)', padding: '40px'}}>
                    <div onSubmit={handleSubmit}>
                        <h2 className="mt-6 text-center text-3xl font-extrabold" style={{color: '#003355'}}>
                            Reset your password
                        </h2>
                        <p className="mt-2 text-center text-sm" style={{color: '#003355', fontFamily: 'Open Sans'}}>
                            Enter your email address and we'll send you a verification code
                        </p>
                    </div>

                    <div className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="email" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                style={{
                                    background: '#F9F8F5',
                                    border: error ? '1px solid #EF4444' : '1px solid #8D908F',
                                    borderRadius: 10,
                                    padding: '12px 16px',
                                    width: '100%',
                                    fontSize: 16,
                                    fontFamily: 'Open Sans',
                                    color: '#8D908F'
                                }}
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (error) setError(null);
                                }}
                                disabled={isLoading || success}
                            />
                        </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="rounded-md bg-green-50 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-green-700">
                                        Password reset email sent! Redirecting to verification page...
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading || success}
                                style={{
                                    width: '100%',
                                    padding: '15px',
                                    background: isLoading || success ? '#D1D5DB' : '#003355',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontSize: 16,
                                    fontFamily: 'Roboto',
                                    fontWeight: 600,
                                    cursor: isLoading || success ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending...
                                    </div>
                                ) : success ? (
                                    'Email Sent!'
                                ) : (
                                    'Send Reset Code'
                                )}
                            </button>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={handleBackToLogin}
                                style={{color: '#003355', fontSize: 14, fontFamily: 'Open Sans', fontWeight: 600, background: 'none', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1}}
                                disabled={isLoading}
                            >
                                Back to Login
                            </button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
    );
}