import { VError } from 'verror'

enum BackendErrorNames {
    GENWITNESS_ERROR = 'GENWITNESS_ERROR',
    GENWITNESS_WRONG_NUM_INPUTS = 'GENWITNESS_WRONG_NUM_INPUTS',
    BACKEND_ECHO_MSG_BLANK = 'BACKEND_ECHO_MSG_BLANK'
}

const errorCodes = {
    GENWITNESS_ERROR: -32000,
    GENWITNESS_WRONG_NUM_INPUTS: -32001,
    BACKEND_ECHO_MSG_BLANK: -32002,
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
