import * as Koa from 'koa';
import * as JsonRpc from '../jsonRpc'
import * as Ajv from 'ajv'
import echoRoute from './echo'
import genWitnessRoute from './genWitness'
import getSignalIndexRoute from './getSignalIndex'

interface Route {
    reqValidator: Ajv.ValidateFunction
    route(bodyData: JsonRpc.Request): Promise<JsonRpc.Response> 
}

// Define routes here
const routes = {
    test_echo: echoRoute,
    gen_witness: genWitnessRoute,
    get_signal_index: getSignalIndexRoute,
}

// Invoke the route
const handle = async (reqData: JsonRpc.Request, state: any) => {
    if (Object.keys(routes).indexOf(reqData.method) === -1) {
        return JsonRpc.genErrorResponse(
            reqData.id, 
            JsonRpc.Errors.methodNotFound.code,
            JsonRpc.Errors.methodNotFound.message,
        )
    }

    try {
        const route = routes[reqData.method]

        // validate the request params
        const validParams = route.reqValidator ? route.reqValidator(reqData.params) : true
        if (validParams) {
            const result = await route.route(reqData.params, state)

            return JsonRpc.genSuccessResponse(reqData.id, result)

        } else {

            return JsonRpc.genErrorResponse(
                reqData.id, 
                JsonRpc.Errors.invalidParams.code,
                JsonRpc.Errors.invalidParams.message,
            )
        }
    } catch (err) {
        return JsonRpc.genErrorResponse(
            reqData.id,
            err.code,
            err.message,
            err.data,
        )
    }
}

const genRouter = (state: any) => {
    return async (
        ctx: Koa.Context,
        _: Function,
    ) => {
        // Assume that ctx.body is already valid JSON and that it has already been
        // validated in a previous middleware layer
        const reqData = JSON.parse(ctx.request.rawBody)

        let resData

        // Check whether the request is a batch or single request
        if (Array.isArray(reqData)) {
            resData = await Promise.all(
                reqData.map((data: any) => {
                    return handle(data, state)
                })
            )
        } else {
            resData = await handle(reqData, state)
        }

        ctx.type = 'application/json-rpc'
        ctx.body = resData
    }
}

export { genRouter }
