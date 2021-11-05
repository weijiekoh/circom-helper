import * as fs from 'fs'
import * as path from 'path'
import * as shelljs from 'shelljs'
import * as errors from '../errors'
import { genValidator } from './utils'
const binFileUtils = require('@iden3/binfileutils')

const countItemInputs = (item: any) => {
    let numInputs = 0
    if (typeof item === 'object') {
        for (const e of item) {
            numInputs += countItemInputs(e)
        }
    } else {
        numInputs += 1
    }
    return numInputs
}

const countInputs = (inputs: any) => {
    let numInputs = 0
    for (const key of Object.keys(inputs)) {
        numInputs += countItemInputs(inputs[key])
    }
    return numInputs
}

const handler = async (
    { circuit, inputs },
    state: any,
) => {
    if (Object.keys(state.witnessGeneratorExes).indexOf(circuit) === -1) {
        const errorMsg = 'Circuit not found'
        throw{
            code: errors.errorCodes.GENWITNESS_CIRCUIT_NOT_FOUND,
            message: errorMsg,
            data: errors.genError(
                errors.BackendErrorNames.GENWITNESS_CIRCUIT_NOT_FOUND,
                errorMsg,
            )
        }
    }
    const buildDir = state.buildDir
    const tempDir = state.tempDir
    const now = Date.now().toString()
    const snarkjsPath = state.snarkjsPath
    const inputJsonFilepath = path.join(buildDir, `${circuit}.${now}.in.json`)
    const outputWtnsFilepath = path.join(buildDir, `${circuit}.${now}.out.wtns`)
    const outputJsonFilepath = path.join(buildDir, `${circuit}.${now}.out.json`)
    const expectedNumInputs = state.numInputsPerCircuit[circuit]

    // Count the number of elements in inputs
    const numInputs = countInputs(inputs)
    if (expectedNumInputs !== numInputs) {
        const errorMsg = 'Wrong number of inputs'
        throw {
            code: errors.errorCodes.GENWITNESS_WRONG_NUM_INPUTS,
            message: errorMsg,
            data: errors.genError(
                errors.BackendErrorNames.GENWITNESS_WRONG_NUM_INPUTS,
                errorMsg,
            )
        }
    }

    // The witness generator executable
    const exe = path.join(buildDir, state.witnessGeneratorExes[path.basename(circuit)])
    try {
        fs.writeFileSync(
            inputJsonFilepath,
            JSON.stringify(inputs),
        )

        // Run the witness generation binary
        let cmd = `${exe} ${inputJsonFilepath} ${outputWtnsFilepath}`
        //const output = shelljs.exec(cmd, {silent: true})
        let output = shelljs.exec(cmd)
        if (output.code !== 0) {
            throw Error(output.stderr)
        }

        // Convert the wtns file to JSON
        cmd = `node ${snarkjsPath} wej ${outputWtnsFilepath} ${outputJsonFilepath}`
        output = shelljs.exec(cmd)
        if (output.code !== 0) {
            throw Error(output.stderr)
        }

        const witness = JSON.parse(fs.readFileSync(outputJsonFilepath).toString())

        cmd = `rm ${inputJsonFilepath} ${outputJsonFilepath}`
        shelljs.exec(cmd)

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
