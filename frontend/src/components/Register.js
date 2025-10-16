import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext"; 

const Register = () => {
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const navigate = useNavigate();
  const { register } = useAuth();

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 20;
    if (/[A-Z]/.test(pwd)) strength += 20;
    if (/[a-z]/.test(pwd)) strength += 20;
    if (/[0-9]/.test(pwd)) strength += 20;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) strength += 20;
    return strength;
  };

  // Simple validation for password requirements
  const validatePassword = (pwd) => {
    if (pwd.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pwd)) return "Password must include an uppercase letter.";
    if (!/[a-z]/.test(pwd)) return "Password must include a lowercase letter.";
    if (!/[0-9]/.test(pwd)) return "Password must include a number.";
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(pwd)) return "Password must include a special character.";
    return "";
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    setPasswordStrength(getPasswordStrength(pwd));
    setPasswordError(validatePassword(pwd));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
      return setPasswordError(pwdError);
    }

    try {
      setError("");
      setPasswordError("");
      setLoading(true);

      await register(firstname, lastname, email, password);

      localStorage.setItem("registrationDate", new Date().toISOString());
      localStorage.setItem("isFirstTimeUser", "true");

      navigate("/confirm-registration", {
        state: {
          email,
          isFirstTime: true,
        },
      });
    } catch (err) {
      setError(
        "Registration failed: " + (err.response?.data?.detail || "Please try again later")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign Up for Idii
        </h2>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Error messages */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}
          {passwordError && (
            <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700">{passwordError}</div>
          )}

          <div className="space-y-4">
            <input
              id="firstname"
              type="text"
              required
              placeholder="First Name"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              className="block w-full px-3 py-2 placeholder-gray-400 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors duration-150"
            />

            <input
              id="lastname"
              type="text"
              required
              placeholder="Last Name"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              className="block w-full px-3 py-2 placeholder-gray-400 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors duration-150"
            />

            <input
              id="email-address"
              type="email"
              required
              placeholder="Email Address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 placeholder-gray-400 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors duration-150"
            />

            {/* Password Field with Strength Meter and Tooltip */}
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Password"
                autoComplete="new-password"
                value={password}
                onChange={handlePasswordChange}
                className={`block w-full px-3 py-2 placeholder-gray-400 text-gray-900 border rounded-md sm:text-sm transition-colors duration-150
                  ${passwordError
                    ? "border-yellow-500 focus:ring-yellow-500 focus:border-yellow-500"
                    : "border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>

              {/* Strength Meter */}
              {password && (
                <div className="mt-1">
                  <div className="h-2 w-full rounded-md bg-gray-200">
                    <div
                      className={`h-2 rounded-md transition-all duration-300 ${
                        passwordStrength < 40
                          ? "w-1/4 bg-red-500"
                          : passwordStrength < 70
                          ? "w-2/4 bg-yellow-400"
                          : "w-full bg-green-500"
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-700">
                    Strength:{" "}
                    <span
                      className={
                        passwordStrength < 40
                          ? "text-red-500"
                          : passwordStrength < 70
                          ? "text-yellow-500"
                          : "text-green-600"
                      }
                    >
                      {passwordStrength < 40
                        ? "Weak"
                        : passwordStrength < 70
                        ? "Medium"
                        : "Strong"}
                    </span>
                  </p>
                </div>
              )}

              {/* Password Requirements Tooltip */}
              {password && (
                <div className="mt-2 p-3 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                  <p className="font-medium mb-1">Password must include:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li className={password.length >= 8 ? "text-green-600" : "text-gray-400"}>
                      At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(password) ? "text-green-600" : "text-gray-400"}>
                      One uppercase letter
                    </li>
                    <li className={/[a-z]/.test(password) ? "text-green-600" : "text-gray-400"}>
                      One lowercase letter
                    </li>
                    <li className={/[0-9]/.test(password) ? "text-green-600" : "text-gray-400"}>
                      One number
                    </li>
                    <li className={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? "text-green-600" : "text-gray-400"}>
                      One special character
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <input
              id="confirm-password"
              type="password"
              required
              placeholder="Confirm Password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full px-3 py-2 placeholder-gray-400 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors duration-150"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Registering..." : "Sign Up"}
          </button>

          {/* Sign-in Link */}
          <div className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500 transition-colors duration-150"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;

