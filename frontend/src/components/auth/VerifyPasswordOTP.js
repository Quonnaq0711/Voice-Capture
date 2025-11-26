import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

// Password validation function
const validatePassword = (pwd) => {
    if (pwd.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pwd)) return "Password must include an uppercase letter.";
    if (!/[a-z]/.test(pwd)) return "Password must include a lowercase letter.";
    if (!/[0-9]/.test(pwd)) return "Password must include a number.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return "Password must include a special character.";
    return "";
};

// Password strength calculator
const getPasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 20;
    if (/[A-Z]/.test(pwd)) strength += 20;
    if (/[a-z]/.test(pwd)) strength += 20;
    if (/[0-9]/.test(pwd)) strength += 20;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) strength += 20;
    return strength;
};

export default function VerifyPasswordOTP() {
    const { state } = useLocation();
    const [otp, setOTP] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [error, setError] = useState(null);
    const nav = useNavigate();
    const { verifyPasswordOTP } = useAuth();

    const handlePasswordChange = (e) => {
        const pwd = e.target.value;
        setNewPassword(pwd);
        setPasswordStrength(getPasswordStrength(pwd));
        setPasswordError(validatePassword(pwd));
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate password
        const pwdError = validatePassword(newPassword);
        if (pwdError) {
            setPasswordError(pwdError);
            return;
        }

        // Check password confirmation
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

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
                                onChange={handlePasswordChange}
                                placeholder="Enter new password"
                                required
                                className={`appearance-none rounded-md relative block w-full px-3 py-2 border ${
                                    passwordError ? "border-yellow-500" : error ? "border-red-300" : "border-gray-300"
                                } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                            />
                            {/* Password Strength Meter */}
                            {newPassword && (
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-600">Password strength</span>
                                        <span className={
                                            passwordStrength < 40 ? "text-red-500" :
                                            passwordStrength < 80 ? "text-yellow-500" : "text-green-500"
                                        }>
                                            {passwordStrength < 40 ? "Weak" : passwordStrength < 80 ? "Medium" : "Strong"}
                                        </span>
                                    </div>
                                    <div className="h-1 bg-gray-200 rounded">
                                        <div
                                            className={`h-full rounded transition-all duration-300 ${
                                                passwordStrength < 40 ? "bg-red-500" :
                                                passwordStrength < 80 ? "bg-yellow-500" : "bg-green-500"
                                            }`}
                                            style={{ width: `${passwordStrength}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            {/* Password Validation Error */}
                            {passwordError && (
                                <p className="mt-1 text-xs text-yellow-600">{passwordError}</p>
                            )}
                        </div>

                        {/* Confirm Password Input */}
                        <div>
                            <label htmlFor="confirmPassword" className="sr-only">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    if (error) setError(null);
                                }}
                                placeholder="Confirm new password"
                                required
                                className={`appearance-none rounded-md relative block w-full px-3 py-2 border ${
                                    error && error.includes("match") ? "border-red-300" : "border-gray-300"
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