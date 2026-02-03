import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Checking for whitespace in farmer and group data...\n')

    // Check Farmers
    const farmers = await prisma.farmer.findMany({
        include: { group: true }
    })

    let farmerIssues = 0
    for (const farmer of farmers) {
        const issues = []

        if (farmer.name !== farmer.name.trim()) {
            issues.push(`name: "${farmer.name}"`)
        }
        if (farmer.farmerNo !== farmer.farmerNo.trim()) {
            issues.push(`farmerNo: "${farmer.farmerNo}"`)
        }
        if (farmer.items && farmer.items !== farmer.items.trim()) {
            issues.push(`items: "${farmer.items}"`)
        }
        if (farmer.phone && farmer.phone !== farmer.phone.trim()) {
            issues.push(`phone: "${farmer.phone}"`)
        }

        if (issues.length > 0) {
            console.log(`Farmer ID ${farmer.id}: ${issues.join(', ')}`)
            farmerIssues++
        }
    }

    // Check Producer Groups
    const groups = await prisma.producerGroup.findMany()

    let groupIssues = 0
    for (const group of groups) {
        const issues = []

        if (group.name !== group.name.trim()) {
            issues.push(`name: "${group.name}"`)
        }
        if (group.code !== group.code.trim()) {
            issues.push(`code: "${group.code}"`)
        }
        if (group.certNo !== group.certNo.trim()) {
            issues.push(`certNo: "${group.certNo}"`)
        }

        if (issues.length > 0) {
            console.log(`Group ID ${group.id}: ${issues.join(', ')}`)
            groupIssues++
        }
    }

    console.log(`\n=== Summary ===`)
    console.log(`Farmers with whitespace issues: ${farmerIssues}/${farmers.length}`)
    console.log(`Groups with whitespace issues: ${groupIssues}/${groups.length}`)

    if (farmerIssues === 0 && groupIssues === 0) {
        console.log('\n✅ All data is clean! No whitespace issues found.')
    } else {
        console.log('\n⚠️ Found whitespace issues. Run fix script if needed.')
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
