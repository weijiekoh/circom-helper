const fs = require('fs')
const path = require('path')
const ff = require('ffjavascript')

const readNumInputs = async (filepath: string) => {
    // number of sections
    let fd = fs.openSync(filepath, 'r')
    let buffer = Buffer.alloc(4)
    await fs.readSync(fd, buffer, 0, 4, 8)
    const numSections = ff.utils.leBuff2int(buffer)

    let numPubInputs
    let numPrivInputs

    // for each section
    let ptr = 12
    for (let i = 0; i < numSections; i ++) {
        // section type
        buffer = Buffer.alloc(4)
        await fs.readSync(fd, buffer, 0, 4, ptr)
        const sectionType = ff.utils.leBuff2int(buffer)
        
        ptr += 4

        // sections ize
        buffer = Buffer.alloc(8)
        await fs.readSync(fd, buffer, 0, 4, ptr)
        const sectionSize = Number(ff.utils.leBuff2int(buffer))

        // for the header section
        if (sectionType === BigInt(1)) {
            ptr += 8 + (sectionSize - 20)
            buffer = Buffer.alloc(4)
            await fs.readSync(fd, buffer, 0, 4, ptr)

            numPubInputs = Number(ff.utils.leBuff2int(buffer))

            ptr += 4
            buffer = Buffer.alloc(4)
            await fs.readSync(fd, buffer, 0, 4, ptr)
            numPrivInputs = Number(ff.utils.leBuff2int(buffer))

            return { numPubInputs, numPrivInputs }
        }

        ptr += 8 + Number(sectionSize)
    }

    throw new Error('Invalid R1CS file')
}

const run = async () => {
    const filepath = path.join(__dirname, '..', 'compiled', 'poseidon.r1cs')
    console.log(await readNumInputs(filepath))

}

if (require.main === module) {
    run()
}

export { readNumInputs }
