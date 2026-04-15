import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';

export default function ProfileScreen() {
    const router = useRouter();
    
    useEffect(() => {
        router.replace({ pathname: '/home_dashboard', params: { tab: 'user' } } as any);
    }, []);

    return null;
}
