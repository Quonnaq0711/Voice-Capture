import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function VerifyPasswordOTP() {
    const { state } = useLocation();
    const [otp, setOTP] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState(null);
    const nav = useNavigate();
    const { verifyPasswordOTP } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await verifyPasswordOTP(state.email, otp, newPassword);
            nav('/login', { state: { message: 'Password successfully reset. Login please!' } });
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid OTP or password reset has failed');
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Reset Your Password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Please enter the code sent to <span className="font-medium">{state.email}</span> and your new password
                    </p>
                </div>

                <div className="mt-8 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* OTP Input */}
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
                                    setOTP(e.target.value);
                                    if (error) setError(null);
                                }}
                                placeholder="Enter verification code"
                                required
                                className={`appearance-none rounded-md relative block w-full px-3 py-2 border ${error ? "border-red-300" : "border-gray-300"
                                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                            />
                        </div>

                        {/* New Password Input */}
                        <div>
                            <label htmlFor="newPassword" className="sr-only">
                                New Password
                            </label>
                            <input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    if (error) setError(null);
                                }}
                                placeholder="Enter new password"
                                required
                                className={`appearance-none rounded-md relative block w-full px-3 py-2 border ${error ? "border-red-300" : "border-gray-300"
                                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                            />
                        </div>

                        {/* Error Message */}
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

                        {/* Submit Button */}
                        <div>
                            <button
                                type="submit"
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Reset Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}