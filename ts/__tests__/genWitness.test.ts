const Koa = require('koa')
import axios from 'axios'
import * as path from 'path'
import * as fs from 'fs'
import * as childProcess from 'child_process'
import * as JsonRpc from '../server/jsonRpc'
import * as errors from '../server/errors'
const ff = require('ffjavascript')
const stringifyBigInts = ff.utils.stringifyBigInts
import { run, loadSymbols } from '../'

const PORT = 9000
const HOST = 'http://localhost:' + PORT

const OPTS = {
    headers: {
        'Content-Type': 'application/json',
    }
}

const post = (id: JsonRpc.Id, method: string, params: any) => {
    return axios.post(
        HOST,
        {
            jsonrpc: '2.0',
            id,
            method,
            params,
        },
        OPTS,
    )
}

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

let server
const cmd = `node ./build/index.js -c ./config.example.json -b ./compiled/ -t ./temp/ -p 9000 -nc`
const rootDir = path.join(
    path.resolve(__dirname),
    '..',
    '..',
)

const circuitDirs = JSON.parse(
    fs.readFileSync(
        path.join(rootDir, 'config.example.json'),
    ).toString(),
).circuitDirs

describe('Witness generation', () => {
    beforeAll(async () => {
        server = await run(
            circuitDirs,
            path.join(rootDir, 'compiled'),
            path.join(rootDir, 'temp'),
            9000,
            true,
            false,
        )
    })

    test('handles the gen_witness method', async () => {
        const circuit = 'test'
        const inputs = stringifyBigInts({
            left: BigInt(1),
            right: BigInt(2),
        })

        const resp = await post(1, 'gen_witness', { circuit, inputs })

        expect(resp.status).toEqual(200)

        const witness = resp.data.result.witness

        const symbols = loadSymbols(
            path.join(
                __dirname,
                '..',
                '..',
                'compiled/test.sym',
            )
        )

        const expectedOut = witness[symbols['main.out'].varIdx].toString()
        expect(expectedOut).toEqual('3')
    })


    afterAll(async () => {
        await server.close()
    })
})
