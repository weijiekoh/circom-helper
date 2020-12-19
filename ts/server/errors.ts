import { VError } from 'verror'

enum BackendErrorNames {
    GENWITNESS_ERROR = 'GENWITNESS_ERROR',
    BACKEND_ECHO_MSG_BLANK = 'BACKEND_ECHO_MSG_BLANK'
}

const errorCodes = {
    GENWITNESS_ERROR: -32000,
    BACKEND_ECHO_MSG_BLANK: -32001,
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
