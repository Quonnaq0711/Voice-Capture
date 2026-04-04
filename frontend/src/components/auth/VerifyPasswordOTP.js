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
    // localhost variable
    // const email = useLocation().state?.email || 'dont for get to change this back to email';

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
            <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10 shadow-black shadow-lg">
                <div className="w-full max-w-md" style={{background: 'rgba(255, 255, 255, 0.10)', backdropFilter: 'blur(10px)', borderRadius: 20, border: '1px solid rgba(177, 184, 220, 0.60)', padding: '40px'}}>
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold" style={{color: '#003355'}}>
                            Reset Your Password
                        </h2>
                        <p className="mt-2 text-center text-sm" style={{color: '#003355', fontFamily: 'Open Sans'}}>
                            Please enter the code sent to <span className="font-semibold">{state.email}</span> and your new password
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
                                style={{
                                    background: '#F9F8F5',
                                    border: '1px solid #8D908F',
                                    borderRadius: 10,
                                    padding: '12px 16px',
                                    width: '100%',
                                    fontSize: 16,
                                    fontFamily: 'Open Sans',
                                    color: '#8D908F'
                                }}
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
                                style={{
                                    background: '#F9F8F5',
                                    border: passwordError ? '1px solid #F59E0B' : '1px solid #8D908F',
                                    borderRadius: 10,
                                    padding: '12px 16px',
                                    width: '100%',
                                    fontSize: 16,
                                    fontFamily: 'Open Sans',
                                    color: '#8D908F'
                                }}
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
                                style={{
                                    background: '#F9F8F5',
                                    border: error && error.includes("match") ? '1px solid #EF4444' : '1px solid #8D908F',
                                    borderRadius: 10,
                                    padding: '12px 16px',
                                    width: '100%',
                                    fontSize: 16,
                                    fontFamily: 'Open Sans',
                                    color: '#8D908F'
                                }}
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
                                style={{
                                    width: '100%',
                                    padding: '15px',
                                    background: '#003355',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontSize: 16,
                                    fontFamily: 'Roboto',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Reset Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            </div>
            </div>
    );
}