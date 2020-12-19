import * as fs from 'fs'
import * as path from 'path'
import * as shelljs from 'shelljs'
import * as errors from '../errors'
import { genValidator } from './utils'
const binFileUtils = require('@iden3/binfileutils')
import { writeBin } from '../../wtnsUtils'
const ff = require('ffjavascript')
const stringifyBigInts = ff.utils.stringifyBigInts

const handler = async (
    { circuit, inputs },
    state: any,
) => {
    const buildDir = state.buildDir
    const tempDir = state.tempDir
    const wasmFilepath = path.join(buildDir, circuit + '.wasm')

    // A random hex string.
    // Doesn't need to be secure.
    const rand = BigInt(Math.floor(Math.random() * 4294967296)).toString(16)
    const id = `${(new Date()).toISOString()}.${rand}`

    const wc = state.wcBuilders[path.basename(circuit)]
    const witness = stringifyBigInts(await wc.calculateWitness(inputs, true))

    //const inputFilepath = path.join(
        //tempDir,
        //`${circuit}.${id}.input.json`,
    //)

    //fs.writeFileSync(
        //inputFilepath,
        //JSON.stringify(inputs),
    //)
    //const wtnsFilepath = path.join(tempDir, `${circuit}.${id}.wtns`)
    //const wtnsJsonFilepath = path.join(tempDir, `${circuit}.${id}.wtns.json`)
    //const snarkjsPath = path.join(
        //path.resolve(__dirname),
        //'../../../',
        //'node_modules/snarkjs/build/cli.cjs',
    //)
    //const wtnsBin = await wc.calculateBinWitness(inputs)
    //const fdWtns = await binFileUtils.createBinFile(wtnsFilepath, 'wtns', 2, 2);
    //await writeBin(fdWtns, wtnsBin, wc.prime)
    //await fdWtns.close();

    //let result
    //const wcCmd = `node ${snarkjsPath} wc ${wasmFilepath} ${inputFilepath} ${wtnsFilepath}`
    //result = shelljs.exec(wcCmd)

    //const wejCmd = `node ${snarkjsPath} wej ${wtnsFilepath} ${wtnsJsonFilepath}`
    //result = shelljs.exec(wejCmd)

    //const witness = JSON.parse(
        //fs.readFileSync(wtnsJsonFilepath).toString(),
    //)

    if (!fs.existsSync(wasmFilepath)) {
        const errorMsg = 'wasm file not found: ' + wasmFilepath
        throw {
            code: errors.errorCodes.GENWITNESS_CIRCUIT_NOT_FOUND,
            message: errorMsg,
            data: errors.genError(
                errors.BackendErrorNames.GENWITNESS_CIRCUIT_NOT_FOUND,
                errorMsg,
            )
        }
    }

    return { witness }
}

const route = {
    route: handler,
    reqValidator: genValidator('gen_witness'),
}

export default route
