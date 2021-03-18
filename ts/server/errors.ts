import { VError } from 'verror'

enum BackendErrorNames {
    GENWITNESS_ERROR = 'GENWITNESS_ERROR',
    GENWITNESS_WRONG_NUM_INPUTS = 'GENWITNESS_WRONG_NUM_INPUTS',
    GENWITNESS_CIRCUIT_NOT_FOUND = 'GENWITNESS_CIRCUIT_NOT_FOUND',
    GETSIGNALINDEX_SIGNAL_NOT_FOUND = 'GETSIGNALINDEX_SIGNAL_NOT_FOUND',
    BACKEND_ECHO_MSG_BLANK = 'BACKEND_ECHO_MSG_BLANK'
}

const errorCodes = {
    GENWITNESS_ERROR: -32000,
    GENWITNESS_WRONG_NUM_INPUTS: -32001,
    GENWITNESS_CIRCUIT_NOT_FOUND: -32002,
    GETSIGNALINDEX_SIGNAL_NOT_FOUND: -32003,
    BACKEND_ECHO_MSG_BLANK: -32010,
}

interface BackendError {
    name: BackendErrorNames,
    message: string
    cause?: any
}

/*
 * Convenience function to create and return a VError
 */
const genError = (
    name: BackendErrorNames,
    message: string,
    cause?: any,
) => {

    return new VError({
        name,
        message,
        cause
    })
}

export {
    BackendErrorNames,
    BackendError,
    genError,
    errorCodes,
}
