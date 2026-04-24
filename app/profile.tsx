import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function ProfileScreen() {
    const router = useRouter();
    
    useEffect(() => {
        router.replace({ pathname: '/home_dashboard', params: { tab: 'user' } } as any);
    }, [router]);

    return null;
}
