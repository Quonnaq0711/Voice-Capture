import { Upload, User } from 'lucide-react';
import profileAPI from '../../services/api';
import { useEffect, useState } from 'react';

export default function WelcomeSection({ onUploadResume, onCustomizeProfile}) {
    
    const [userData, setUserData] = useState({ first_name: '', email: '' });
    
     useEffect(() => {
        fetchUserData();        
      }, []);
    
      const fetchUserData = async () => {
          try {
            const data = await profileAPI.getCurrentUser();
            setUserData({
              first_name: data.first_name,  // Fixed: use first_name not name
              email: data.email
            });
          } catch (error) {
            console.error('Error fetching user data:', error);
          }
        };
    
  const handleUploadClick = () => {
    if (onUploadResume) {
      onUploadResume();
    }
  };

  const handleCustomizeClick = () => {
    if (onCustomizeProfile) {
      onCustomizeProfile();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 sm:p-8 md:p-10">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
        Welcome {userData.first_name}
      </h1>
      <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6 text-center max-w-4xl mx-auto">
        This is Idii. A platform where "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor 
        incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
        nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum 
        dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia"
      </p>
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        <button 
          onClick={handleUploadClick}
          className="w-full sm:w-auto px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Upload className="h-5 w-5" />
          Upload Resume
        </button>
        <button 
          onClick={handleCustomizeClick}
          className="w-full sm:w-auto px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <User className="h-5 w-5" />
          Customize Profile
        </button>
      </div>
    </div>
  );
}