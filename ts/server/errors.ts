import { VError } from 'verror'

enum BackendErrorNames {
    GENWITNESS_CIRCUIT_NOT_FOUND = 'GENWITNESS_CIRCUIT_NOT_FOUND',
    BACKEND_ECHO_MSG_BLANK = 'BACKEND_ECHO_MSG_BLANK'
}

const errorCodes = {
    GENWITNESS_CIRCUIT_NOT_FOUND: -32000,
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
