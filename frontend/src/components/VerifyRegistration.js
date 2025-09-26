import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";


export default function VerifyRegistration() {
    const { state } = useLocation();
    const [otp, setOtp] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const nav = useNavigate();
    const { verifyRegistrationOTP, resendRegistrationOTP } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!otp.trim()) {
            setError('Please enter the verification code');
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            await verifyRegistrationOTP(state.email, otp);
            nav('/login', {
                state: {
                    message: 'Account has been successfully verified. Please Login!'
                }
            });
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid OTP or verification failed');
        } finally {
            setLoading(false);
        }
    }

    const handleResendOTP = async () => {
        try {
            await resendRegistrationOTP(state.email);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to resend verification code');
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Verify Your Registration
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        We sent a verification code to your email at {state.email}
                    </p>
                </div>

                <div className="mt-8 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="otp" className="sr-only">
                                Verification Code
                            </label>
                            <input
                                id="otp"
                                name="otp"
                                type="text"
                                value={otp}
                                onChange={(e) => {
                                    setOtp(e.target.value);
                                    if (error) setError(null);
                                }}
                                placeholder="Enter verification code"
                                disabled={loading}
                                required
                                className={`appearance-none rounded-md relative block w-full px-3 py-2 border ${error ? "border-red-300" : "border-gray-300"
                                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                            />
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg
                                            className="h-5 w-5 text-red-400"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Buttons */}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    }`}
                            >
                                {loading ? (
                                    <div className="flex items-center">
                                        <svg
                                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        Verifying...
                                    </div>
                                ) : (
                                    "Verify"
                                )}
                            </button>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={handleResendOTP}
                                disabled={loading}
                                className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                            >
                                Resend Code
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}