import axios from 'axios'

const OPTS = {
    headers: {
        'Content-Type': 'application/json',
    }
}

const post = (
    id: number,
    method: string,
    params: any,
    url = 'http://localhost:9001',
) => {
    return axios.post(
        url,
        {
            jsonrpc: '2.0',
            id,
            method,
            params,
        },
        OPTS,
    )
}

const genWitness = async (
    circuit: string, 
    inputs: any, 
    url = 'http://localhost:9001',
) => {
    const resp = await post(1, 'gen_witness', { circuit, inputs }, url)
    if (resp.data.error) {
        throw Error(resp.data.error.message)
    }
    return resp.data.result.witness
}

const getSignalByName = async (
    circuit: string,
    witness: any,
    name: string,
    url = 'http://localhost:9001',
) => {
    const resp = await post(1, 'get_signal_index', { circuit, name }, url)
    return witness[Number(resp.data.result.index)]
}

export {
    genWitness,
    getSignalByName,
}
