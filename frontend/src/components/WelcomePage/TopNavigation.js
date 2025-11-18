import { Menu, UserCircle, LogOut, ChevronDown } from 'lucide-react';

export default function TopNavigation({
    onMenuToggle,
    onAccountClick,
    onLogoutClick,
    userData,
    avatarUrl,
    isImgError,
    onImageError,
    loadingUser,
    isMobile
})

{
    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Left side - Logo and branding */}
                    <div className="flex items-center space-x-4">
                        {/* Mobile menu button */}
                        {isMobile && (
                            <button
                                onClick={onMenuToggle}
                                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                aria-label="Toggle menu"
                            >
                                <Menu className="h-6 w-6 text-gray-600" />
                            </button>
                        )}

                        {/* Logo and title */}
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">I</span>
                            </div>
                            <h1 className="text-xl font-semibold text-gray-900">Idii.</h1>
                        </div>
                        <div className="hidden lg:flex items-center text-sm text-gray-500">
                            <span>Personal Lifestyle Platform</span>
                        </div>
                    </div>

                    {/* Right side - User profile and logout */}
                    <div className="flex items-center space-x-3">
                        {/* User Profile */}
                        <button
                            onClick={onAccountClick}
                            className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            aria-label="View profile"
                        >
                            <div className="flex-shrink-0">
                                {loadingUser ? (
                                    <div className="h-8 w-8 rounded-full bg-gray-300 animate-pulse"></div>
                                ) : avatarUrl && !isImgError ? (
                                    <img
                                        src={avatarUrl}
                                        alt="User Avatar"
                                        onError={onImageError}
                                        className="h-8 w-8 rounded-full object-cover border-2 border-blue-200"
                                    />
                                ) : (
                                    <UserCircle className="h-8 w-8 text-gray-400" />
                                )}
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-sm font-medium text-gray-900">
                                    {userData.first_name || 'User'}
                                </p>
                                <p className="text-xs text-gray-500 truncate max-w-32">
                                    {userData.email || ''}
                                </p>
                            </div>
                            <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
                        </button>

                        {/* Logout Button */}
                        <button
                            onClick={onLogoutClick}
                            className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            aria-label="Logout"
                        >
                            <LogOut className="w-4 h-4 mr-0 sm:mr-2" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}