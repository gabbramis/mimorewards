import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

function LoginFallback() {
    return (
        <div className="min-h-screen w-full bg-[#FFF6EE] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF1F2D]" />
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <LoginForm />
        </Suspense>
    );
}
