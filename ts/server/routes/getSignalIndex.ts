import * as path from 'path'
import * as errors from '../errors'

const lineByLine = require('n-readlines')

import { genValidator } from './utils'

const handler = async (
    { circuit, name },
    state: any,
) => {

    const result = state.db.prepare(
        'SELECT idx FROM symbols WHERE circuit = ? AND name = ?', 
    ).get(circuit, name)

    if (!result) {
        const errorMsg = 'Signal name not found'
        throw{
            code: errors.errorCodes.GETSIGNALINDEX_SIGNAL_NOT_FOUND,
            message: errorMsg,
            data: errors.genError(
                errors.BackendErrorNames.GETSIGNALINDEX_SIGNAL_NOT_FOUND,
                errorMsg,
            )
        }
    } else {
        return { index: result.idx }
    }
}

const route = {
    route: handler,
    reqValidator: genValidator('get_signal_index'),
}

export default route
