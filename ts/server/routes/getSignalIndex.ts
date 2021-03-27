import * as path from 'path'
import * as errors from '../errors'

const lineByLine = require('n-readlines')

import { genValidator } from './utils'

const handler = async (
    { circuit, name },
    state: any,
) => {

    const symFile = path.join(state.buildDir, circuit + '.sym')
    const liner = new lineByLine(symFile)
    let line
    let lineNumber = 0
    let index

    let found = false

    while (line = liner.next().toString()) {
        const vals = line.split(',')
        if (vals.length > 2) {
            if (vals[3] === name) {
                index = Number(vals[1])
                found = true
                break
            }
        }
    }
    
    if (!found) {
        const errorMsg = 'Signal name not found'
        throw{
            code: errors.errorCodes.GETSIGNALINDEX_SIGNAL_NOT_FOUND,
            message: errorMsg,
            data: errors.genError(
                errors.BackendErrorNames.GETSIGNALINDEX_SIGNAL_NOT_FOUND,
                errorMsg,
            )
        }
    }

    return { index }
}

const route = {
    route: handler,
    reqValidator: genValidator('get_signal_index'),
}

export default route
