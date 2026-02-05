
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Creating Admin User...')

    const username = 'admin'
    const password = 'password1234' // Change this!
    const hashedPassword = await bcrypt.hash(password, 10)

    try {
        const user = await prisma.user.upsert({
            where: { username },
            update: {
                password: hashedPassword,
                role: 'ADMIN' // Ensure admin role
            },
            create: {
                username,
                password: hashedPassword,
                name: 'Administrator',
                role: 'ADMIN'
            }
        })
        console.log(`User '${user.username}' created/updated successfully.`)
        console.log(`Password: ${password}`)
    } catch (e) {
        console.error('Failed to create user:', e)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
