import { useEffect, useState } from "react";

const PasswordResetTimer = (registrationStrDate) => {
    const now = new Date();
    const registrationDate = new Date(registrationStrDate);
    const count = 90 * 24 * 60 * 60 * 1000 - (now - registrationDate);
    return Math.ceil(count / (1000 * 60 * 60 * 24));
};

export const usePasswordCountDown = () => {
    const [daysLeft, setDaysLeft] = useState(null);
    const [banner, setBanner] = useState(false);
    
    useEffect(() => {
        const registrationDate = localStorage.getItem('registrationDate')
        const updatedPassword = localStorage.getItem('updatedPassword');
        const closeBanner = localStorage.getItem('dismissedBanner');

        if (!registrationDate || updatedPassword === 'true' || closeBanner === 'true') return;

        const days = PasswordResetTimer(registrationDate);
        setDaysLeft(days);

        if (days <= 5 && days >= 0) {
            setBanner(true);

        }        
    }, []);
    
    const closeBanner = () => {
        localStorage.setItem('dismissedBanner', 'true');
        setBanner(false);
    }

    return { banner, daysLeft, closeBanner }
};
