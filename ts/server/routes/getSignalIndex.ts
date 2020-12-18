import { genValidator } from './utils'

const handler = async (
    { circuit, name },
    state: any,
) => {

    const index = Number(state.symbols[circuit][name].varIdx)

    return { index }
}

const route = {
    route: handler,
    reqValidator: genValidator('get_signal_index'),
}

export default route
