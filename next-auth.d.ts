import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            name: string;
            role: string;
            department?: string;
            position?: string;
        } & DefaultSession['user'];
    }

    interface User {
        id: number;
        username: string;
        name: string;
        role: string;
        department?: string | null;
        position?: string | null;
        phone?: string | null;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: number;
        role: string;
        username: string;
    }
}
