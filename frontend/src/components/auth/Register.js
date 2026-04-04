import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

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

  // Use refs to prevent premature clearing
  const errorTimerRef = useRef(null);
  const passwordErrorTimerRef = useRef(null);

  // Auto-dismiss error messages after 10 seconds (industry standard + buffer)
  useEffect(() => {
    // Clear any existing timer
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }

    if (error) {
      // Set new timer with ref to prevent cleanup issues
      errorTimerRef.current = setTimeout(() => {
        setError('');
        errorTimerRef.current = null;
      }, 10000); // 10 seconds - ensure visibility
    }

    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, [error]);

  // Auto-dismiss password error messages after 10 seconds
  useEffect(() => {
    // Clear any existing timer
    if (passwordErrorTimerRef.current) {
      clearTimeout(passwordErrorTimerRef.current);
    }

    if (passwordError) {
      passwordErrorTimerRef.current = setTimeout(() => {
        setPasswordError('');
        passwordErrorTimerRef.current = null;
      }, 10000);
    }

    return () => {
      if (passwordErrorTimerRef.current) {
        clearTimeout(passwordErrorTimerRef.current);
      }
    };
  }, [passwordError]);

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
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return "Password must include a special character.";
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

    // Don't clear errors immediately - let user read them if retrying
    // Only start loading state
    setLoading(true);

    try {
      await register(firstname, lastname, email, password);

      // Clear errors only on successful registration
      setError("");
      setPasswordError("");

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
          <h2 className="mt-6 text-center text-3xl font-extrabold" style={{color: '#003355'}}>
            Sign Up for Idii
          </h2>

        <div className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Error messages */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 relative animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="text-sm text-red-700 flex-1">{error}</div>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="ml-3 flex-shrink-0 inline-flex text-red-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-md p-1 transition-colors"
                  aria-label="Dismiss"
                >
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          {passwordError && (
            <div className="rounded-md bg-yellow-50 p-4 relative animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="text-sm text-yellow-700 flex-1">{passwordError}</div>
                <button
                  type="button"
                  onClick={() => setPasswordError('')}
                  className="ml-3 flex-shrink-0 inline-flex text-yellow-400 hover:text-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 rounded-md p-1 transition-colors"
                  aria-label="Dismiss"
                >
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div>
            <input
              id="firstname"
              type="text"
              required
              placeholder="First Name"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              className="w-full h-15 px-5 rounded-[10px] bg-[#F9F8F5] border border-[#8D908F] text-[#8D908F] placeholder-[#8D908F] font-['Space_Mono'] text-base focus:outline-none focus:ring-2 focus:ring-[#003355]"
            />
            </div>            

          <div className="mb-2">
            <input
              id="lastname"
              type="text"
              required
              placeholder="Last Name"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              className="w-full h-15 px-5 rounded-[10px] bg-[#F9F8F5] border border-[#8D908F] text-[#8D908F] placeholder-[#8D908F] font-['Space_Mono'] text-base focus:outline-none focus:ring-2 focus:ring-[#003355]"
            />
          </div>

          <div>
            <input
              id="email-address"
              type="email"
              required
              placeholder="Email Address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-15 px-5 rounded-[10px] bg-[#F9F8F5] border border-[#8D908F] text-[#8D908F] placeholder-[#8D908F] font-['Space_Mono'] text-base focus:outline-none focus:ring-2 focus:ring-[#003355]"

            />
          </div>

            {/* Password Field with Strength Meter and Tooltip */}
            <div>
              {/* <div className="relative"> */}
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  autoComplete="new-password"
                  value={password}
                  onChange={handlePasswordChange}
                  onPaste={(e) => {
                    // Trim whitespace from pasted content to prevent accidental spaces
                    const pastedText = e.clipboardData.getData('text').trim();
                    e.preventDefault();
                    setPassword(pastedText);
                    setPasswordStrength(getPasswordStrength(pastedText));
                    setPasswordError(validatePassword(pastedText));
                  }}
                  className={`w-full h-15 px-5 rounded-[10px] bg-[#F9F8F5] border border-[#8D908F] text-[#8D908F] placeholder-[#8D908F] font-['Space_Mono'] text-base focus:outline-none focus:ring-2 focus:ring-[#003355]

                    ${passwordError
                      ? "border-yellow-500 focus:ring-yellow-500 focus:border-yellow-500"
                      : "border-gray-300 focus:ring-primary-500 focus:border-[#003355]"
                    }`}
                />
              {/* </div> */}
              
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
              </div>
              </div>
              </div>

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
            <div>
              <input
                id="confirm-password"
                type="password"
                required
                placeholder="Confirm Password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onPaste={(e) => {
                  // Trim whitespace from pasted content to prevent accidental spaces
                  const pastedText = e.clipboardData.getData('text').trim();
                  e.preventDefault();
                  setConfirmPassword(pastedText);
                }}
                className="w-full h-15 px-5 pr-12 rounded-[10px] bg-[#F9F8F5] border border-[#8D908F] text-[#8D908F] placeholder-[#8D908F] font-['Open_Sans'] text-base focus:outline-none focus:ring-2 focus:ring-[#003355]"

              />
              {password && confirmPassword && password === confirmPassword && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: loading ? '#D1D5DB' : '#003355',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 16,
              fontFamily: 'Roboto',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? "Registering..." : "Sign Up"}
          </button>

          {/* Sign-in Link */}
          <div className="text-center" style={{color: '#003355', fontSize: 12, fontFamily: 'Open Sans'}}>
            Already have an account?{" "}
            <Link
              to="/login"
              style={{color: '#003355', fontWeight: 600, textDecoration: 'none'}}
            >
              Sign in
            </Link>
          </div>
      </div>
      </div>
  );
};
export default Register;

