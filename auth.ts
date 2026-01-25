import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function getUser(username: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { username },
        });
        return user;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                try {
                    console.log('Authorizing user...');
                    const parsedCredentials = z
                        .object({ username: z.string(), password: z.string().min(6) })
                        .safeParse(credentials);

                    if (parsedCredentials.success) {
                        const { username, password } = parsedCredentials.data;
                        console.log(`Searching for user: ${username}`);
                        const user = await getUser(username);
                        if (!user) {
                            console.log('User not found in database');
                            return null;
                        }

                        console.log('User found, comparing password...');
                        const passwordsMatch = await bcrypt.compare(password, user.password);
                        if (passwordsMatch) {
                            console.log('Password match! Login successful.');
                            return user;
                        } else {
                            console.log('Password mismatch');
                        }
                    } else {
                        console.log('Invalid credentials format');
                    }

                    console.log('Invalid credentials');
                    return null;
                } catch (error) {
                    console.error('Authorization error:', error);
                    return null;
                }
            },
        }),
    ],
});
