import * as errors from '../errors'
import { genValidator } from './utils'

const echo = async ({ message }, _: any) => {
    if (message !== '') {
        return { message }
    } else {
        const errorMsg = 'the message param cannot be blank'
        throw {
            code: errors.errorCodes.BACKEND_ECHO_MSG_BLANK,
            message: errorMsg,
            data: errors.genError(
                errors.BackendErrorNames.BACKEND_ECHO_MSG_BLANK,
                errorMsg,
            )
        }
    }
}

const echoRoute = {
    route: echo,
    reqValidator: genValidator('echo'),
}

export default echoRoute
