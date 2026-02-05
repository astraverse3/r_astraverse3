
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Verifying Admin User...')

    const username = 'admin'
    const password = 'password1234'

    const user = await prisma.user.findUnique({
        where: { username }
    })

    if (!user) {
        console.error(`User '${username}' NOT FOUND in database!`)
        return
    }

    console.log(`User found: ${user.username}, Role: ${user.role}`)

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    console.log(`Password '${password}' match result: ${isMatch}`)

    if (!isMatch) {
        console.log('Re-hashing password and updating...')
        const newHash = await bcrypt.hash(password, 10)
        await prisma.user.update({
            where: { username },
            data: { password: newHash }
        })
        console.log('Password updated. Try logging in again.')
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
