import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function FavoriteScreen() {
    const router = useRouter();
    
    useEffect(() => {
        router.replace({ pathname: '/home_dashboard', params: { tab: 'heart' } } as any);
    }, [router]);

    return null;
}
