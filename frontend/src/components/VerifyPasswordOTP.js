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
            await verifyPasswordOTP(state.email, otp, "password_reset", newPassword);
            nav('/login', { state: { message: 'Password successfully reset. Login please!' } });
        } catch (err) {
            setError(err.repsonse?.data?.detail || 'Invalid OTP or password reset has failed');
        }
    }

    return (
        <div className="">
            <form onSubmit={handleSubmit}>
                <p>Please enter the code sent to {state.email}</p>
                <input
                    value={otp}
                    onChange={(e) => setOTP(e.target.value)}
                    placeholder="OTP Code"
                />
                <input 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    placeholder="Enter new password"
                />
                <button type="submit">Reset Password</button>
                {error && <p>{error}</p>}
            </form>
        </div>
    );
}