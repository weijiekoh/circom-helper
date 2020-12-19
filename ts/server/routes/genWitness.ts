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

    // The pregenerated WitnessCalculatorBuilder
    const wc = state.wcBuilders[path.basename(circuit)]

    try {
        // Generate the witness
        const witness = stringifyBigInts(await wc.calculateWitness(inputs, true))
        return { witness }
    } catch (e) {
        const errorMsg = e.toString()
        throw {
            code: errors.errorCodes.GENWITNESS_ERROR,
            message: errorMsg,
            data: errors.genError(
                errors.BackendErrorNames.GENWITNESS_ERROR,
                errorMsg,
            )
        }
    }
}

const route = {
    route: handler,
    reqValidator: genValidator('gen_witness'),
}

export default route
