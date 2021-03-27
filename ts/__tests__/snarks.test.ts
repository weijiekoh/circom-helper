jest.setTimeout(90000)
const Koa = require('koa')
import axios from 'axios'
import * as path from 'path'
import * as fs from 'fs'
import * as childProcess from 'child_process'
import * as JsonRpc from '../server/jsonRpc'
import * as errors from '../server/errors'
const ff = require('ffjavascript')
const stringifyBigInts = ff.utils.stringifyBigInts
import { run } from '../'
import {
    callGenWitness as genWitness,
    callGetSignalByName as getSignalByName,
} from '../'

const PORT = 9002
const HOST = 'http://localhost:' + PORT

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

const circomPath = path.join(rootDir, 'node_modules/circom/cli.js')
const snarkjsPath = path.join(rootDir, 'node_modules/snarkjs/build/cli.cjs')
const circomRuntimePath = path.join(rootDir, 'node_modules/circom_runtime')
const ffiasmPath = path.join(rootDir, 'node_modules/ffiasm')

describe('Witness generation', () => {
    beforeAll(async () => {
        server = await run(
            circomPath,
            snarkjsPath,
            circomRuntimePath,
            ffiasmPath,
            circuitDirs,
            path.join(rootDir, 'compiled'),
            PORT,
            true,
            false,
            '4096',
            '65536',
            false,
        )
    })

    test('the gen_witness method should return a valid witness', async () => {
        const circuit = 'poseidon'
        const inputs = stringifyBigInts({
            in: [BigInt(1), BigInt(2)],
            expectedHash: BigInt('0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a'),
        })

        const witness = await genWitness(circuit, inputs, HOST)
        const expectedOut = BigInt(await getSignalByName(circuit, witness, 'main.out', HOST)).toString(16)
        expect(expectedOut).toEqual('115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a')
    })

    test('the gen_witness method should return an error if the inputs are wrong', async () => {
        expect.assertions(1)
        const circuit = 'poseidon'
        const inputs = stringifyBigInts({
            in: [BigInt(1), BigInt(2)],
            expectedHash: BigInt(1234), // incorrect hash value
        })

        try {
            const witness = await genWitness(circuit, inputs, HOST)
        } catch {
            expect(true).toBeTruthy()
        }
    })

    test('the gen_witness method should return an error if an input is missing', async () => {
        expect.assertions(1)
        const circuit = 'poseidon'
        const inputs = stringifyBigInts({
            in: [BigInt(1), BigInt(2)],
        })

        try {
            const witness = await genWitness(circuit, inputs, HOST)
        } catch {
            expect(true).toBeTruthy()
        }
    })

    afterAll(async () => {
        await server.close()
    })
})
