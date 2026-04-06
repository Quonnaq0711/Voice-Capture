import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const location = useLocation();

  const errorTimerRef = useRef(null);
  const infoTimerRef = useRef(null);

  useEffect(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }

    if (error) {
      errorTimerRef.current = setTimeout(() => {
        setError('');
        errorTimerRef.current = null;
      }, 3000);
    }

    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, [error]);

  useEffect(() => {
    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
    }

    if (info) {
      infoTimerRef.current = setTimeout(() => {
        setInfo('');
        infoTimerRef.current = null;
      }, 3000);
    }

    return () => {
      if (infoTimerRef.current) {
        clearTimeout(infoTimerRef.current);
      }
    };
  }, [info]);

  useEffect(() => {
    if (location.state?.message) {
      setInfo(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      setError('');

      const isFirstTimeUser = localStorage.getItem('isFirstTimeUser');
      if (isFirstTimeUser === 'true') {
        localStorage.removeItem('isFirstTimeUser');
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err.response?.data?.detail || err.message);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-slate-200 overflow-hidden">
      {/* Decorative white circles - Small (20x20) */}
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '85px', top: '432px' }} />
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '222px', top: '483px' }} />
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '313px', top: '378px' }} />
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '1189px', top: '500px' }} />
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '1322px', top: '180px' }} />
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '1254px', top: '32px' }} />
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '1386px', top: '50px' }} />
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '308px', top: '191px' }} />
      <div className="absolute w-5 h-5 rounded-full bg-white" style={{ left: '188px', top: '628px' }} />

      {/* Decorative white circles - Large (30x30) */}
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '189px', top: '82px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '272px', top: '655px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '1013px', top: '52px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '1386px', top: '102px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '1193px', top: '297px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '1188px',  top: '630px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '1066px', top: '585px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '1264px', top: '440px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '1342px', top: '649px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '72px', top: '349px' }} />
      <div className="absolute w-6 h-6 rounded-full bg-white" style={{ left: '42px', top: '649px' }} />

      {/* Main Login Card */}
      <div className="absolute w-[550px] h-[400px] rounded-[20px] bg-white/10 backdrop-blur-md border border-[#003355] shadow-black shadow-lg" style={{ left: '470px', top: '140px' }}>
        
        {/* Logo placeholder */}
         <div className="flex justify-center pt-8 pb-6"> 
          <img 
            src="/Fulltext-idii-logo2-svg.png" 
            alt="Logo" 
            className="w-64 h-34 object-contain"
          />
        </div> 

        {/* Form Container */}
        <div className="px-9 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 p-3 rounded-md text-red-600 text-sm font-medium">
              {error}
            </div> 
          )}  

          {/* Info Message */}
          {info && (
            <div className="bg-blue-50 p-3 rounded-md text-blue-600 text-sm font-medium">
              {info}
            </div>
          )} 

          {/* Email/Username Input */}
          <div>
            <input
              type="text"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-15 px-5 rounded-[10px] bg-[#F9F8F5] border border-[#8D908F] text-[#8D908F] placeholder-[#8D908F] font-['Space_Mono'] text-base focus:outline-none focus:ring-2 focus:ring-[#003355]"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-15 px-5 pr-12 rounded-[10px] bg-[#F9F8F5] border border-[#8D908F] text-[#8D908F] placeholder-[#8D908F] font-['Open_Sans'] text-base focus:outline-none focus:ring-2 focus:ring-[#003355]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#8D908F] hover:text-[#003355]"
            >
              {showPassword ? "🙈": "🙉"}
            </button>
          </div>

          {/* Remember Me & Forgot Password */}
           <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-[15px] h-[15px] rounded border border-[#8D908F] bg-[#F9F8F5] cursor-pointer"
              />
              <label htmlFor="remember" className="text-[#003355] font-['Open_Sans'] text-sm font-semibold cursor-pointer">
                Remember Me
              </label>
            </div>
            <Link
              to="/request-password"
              className="text-[#003355] font-['Open_Sans'] text-sm font-semibold hover:underline"
            >
              Forgot Password?
            </Link>
          </div> 

          {/* Login Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full px-4 py-2 rounded-[10px] bg-[#003355] text-white font-['Space_Mono'] text-base font-semibold hover:bg-[#002945] transition-colors disabled:opacity-50 mt-4"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button> 

          {/* Sign Up Link */}
          <div className="text-center pt-4">
            <span className="text-[#003355] font-['Open_Sans'] text-md font-normal">
              Don't have an account?{' '}
            </span>
            <Link
              to="/signup"
              className="text-[#003355] font-['Open_Sans'] text-sm font-semibold hover:underline"
            >
              Sign Up
            </Link>
          </div> 
        </div> 
      </div>
    </div> 
  ); 
};

export default Login;
