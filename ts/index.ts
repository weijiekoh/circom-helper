#!/usr/bin/env node

import * as argparse from 'argparse'
import * as fs from 'fs'
import * as path from 'path'
import * as shelljs from 'shelljs'
import { launchServer } from './server'

const fastFile = require('fastfile')
import circomRuntime from 'circom_runtime'
const { WitnessCalculatorBuilder } = circomRuntime

const CIRCOM_FILE_EXTENSION = '.circom'
const CACHE_DIRNAME = 'cache'

const version = JSON.parse(fs.readFileSync(
    path.join(
        __dirname,
        '..',
        'package.json',
    ),
).toString()).version

const compile = (
    filepath: string,
    buildDir: string,
    noClobber: boolean,
    quiet: boolean,
) => {
    const log = (s: string) => {
        if (!quiet) {
            console.log(s)
        }
    }

    const circomPath = path.join(
        path.resolve(__dirname),
        '..',
        'node_modules/circom/cli.js'
    )
    const filename = path.basename(filepath)
    const withoutExtension = filename.slice(
        0,
        filename.length - CIRCOM_FILE_EXTENSION.length
    )

    const r1csFilepath = 
        path.join(path.resolve(buildDir), withoutExtension + '.r1cs')
    const cFilepath = 
        path.join(path.resolve(buildDir), withoutExtension + '.c')
    const wasmFilepath = 
        path.join(path.resolve(buildDir), withoutExtension + '.wasm')
    const watFilepath = 
        path.join(path.resolve(buildDir), withoutExtension + '.wat')
    const symFilepath = 
        path.join(path.resolve(buildDir), withoutExtension + '.sym')

    if (noClobber) {
        let skip = true
        for (const f of [
            r1csFilepath,
            cFilepath,
            wasmFilepath,
            watFilepath,
            symFilepath,
        ]) {
            skip = skip && fs.existsSync(f)
        }
        
        if (skip) {
            log(`Skipping ${filepath}`)
            return { r1csFilepath, wasmFilepath, symFilepath, watFilepath }
        }
    }

    log(`Compiling ${filepath}`)
    const cmd = `NODE_OPTIONS=--max-old-space-size=4096 node ${circomPath} ` +
        `${filepath} -r ${r1csFilepath} -c ${cFilepath} -w ${wasmFilepath} ` +
        `-t ${watFilepath} -s ${symFilepath}`
    shelljs.exec(cmd)

    return { r1csFilepath, wasmFilepath, symFilepath, watFilepath }
}

const run = async (
    circuitDirs: string[],
    buildDir: string,
    tempDir: string,
    port: number,
    noClobber: boolean,
    quiet: boolean,
) => {
    const log = (s: string) => {
        if (!quiet) {
            console.log(s)
        }
    }

    // For each circom file in each circuit dir, compile its circom files
    const filesToCompile: string[] = []
    const d: any = {}
    for (const c of circuitDirs) {
        for (const file of fs.readdirSync(c)) {
            if (file.endsWith(CIRCOM_FILE_EXTENSION)) {
                filesToCompile.push(path.join(path.resolve(c), file))

                if (d[file]) {
                    // Emit an error if there are any filename collisions
                    // e.g. a/test.circom collides with b.circom
                    console.error(
                        `Error: there is more than one circuit ` +
                        `file named ${file}`,
                    )
                    process.exit(1)
                } else {
                    d[file] = true
                }
            }
        }
    }

    const files: any[] = []

    for (const f of filesToCompile) {
        const start = Date.now()
        const filepaths = compile(f, buildDir, noClobber, quiet)
        const end = Date.now()

        const duration = Math.round((end - start) / 1000)

        log(`Took ${duration} seconds`)

        files.push(filepaths)
    }

    const circuitBasename = (f: any) => {
        const l = f.wasmFilepath.length
        return path.basename(
            f.wasmFilepath.slice(0, l - '.wasm'.length)
        )
    }

    // Load every circuit and symbol file
    const wcBuilders: any = {}
    const symbols: any = {}
    for (const f of files) {
        const wc = await loadWasm(f.wasmFilepath)
        wcBuilders[circuitBasename(f)] = wc

        const syms = loadSymbols(f.symFilepath)
        symbols[circuitBasename(f)] = syms
    }

    // Launch the server
    log(`Launching JSON-RPC server at port ${port}`)
    const state = {
        buildDir,
        tempDir,
        wcBuilders,
        symbols,
    }

    return launchServer(port, state)
}

const loadWasm = async (
    wasmFilepath: string,
) => {
    const fdWasm = await fastFile.readExisting(wasmFilepath)
    const wasm = await fdWasm.read(fdWasm.totalSize)
    await fdWasm.close()

    const wc = await WitnessCalculatorBuilder(wasm)
    return wc
}

const loadSymbols = (
    symFilepath: string
) => {
    const symbols = {}
    const lines = fs.readFileSync(symFilepath).toString().split('\n')
    for (const line of lines) {
        const vals = line.split(',')
        symbols[vals[3]] = {
            //labelIdx: Number(vals[0]),
            varIdx: Number(vals[1]),
            //componentIdx: Number(vals[2]),
        }
    }
    return symbols
}

const main = async () => {

    const parser = new argparse.ArgumentParser({ 
        description: 'A convenient way for developers to compile, cache, ' + 
            'and execute circom circuits, as well as to generate proofs.',
    })

    parser.add_argument(
        '-v', '--version',
        { 
            action: 'version',
            version,
        },
    )
    parser.add_argument(
        '-c', '--config',
        { 
            required: true,
            action: 'store', 
            type: String, 
            help: 'The circom-helper config file',
        },
    )
    parser.add_argument(
        '-nc', '--no-clobber',
        { 
            required: false,
            action: 'store_true', 
            help: 'Skip compilation if compiled files exist',
        },
    )
    parser.add_argument(
        '-q', '--quiet',
        { 
            required: false,
            action: 'store_true', 
            help: 'Do not display logs',
        },
    )
    parser.add_argument(
        '-b', '--build_dir',
        { 
            required: true,
            action: 'store', 
            type: String, 
            help: 'The output directory for compiled files',
        },
    )
    parser.add_argument(
        '-t', '--temp_dir',
        { 
            required: true,
            action: 'store', 
            type: String, 
            help: 'The output directory for temporary files',
        },
    )
    parser.add_argument(
        '-p', '--port',
        { 
            required: true,
            action: 'store', 
            type: Number, 
            help: 'The desired port number',
        },
    )

    const args = parser.parse_args()

    const port = args.port
    const configFilepath = path.resolve(args.config)

    if (!fs.existsSync(configFilepath)) {
        console.error('Error: no such config file')
        process.exit(1)
    }

    const config = JSON.parse(fs.readFileSync(configFilepath).toString())

    if (config.circuitDirs == null) {
        console.error('Error: circuitDirs not specified in the config file')
        process.exit(1)
    }


    const buildDirPath = path.resolve(args.build_dir)
    fs.mkdirSync(buildDirPath, { recursive: true })

    const tempDirPath = path.resolve(args.temp_dir)
    fs.mkdirSync(tempDirPath, { recursive: true })

    // Resolve each circuitDir relative to the config filepath
    const resolveCircuitDirpath = (c: string) => {
        const baseDir = path.dirname(configFilepath)
        return path.join(baseDir, c)
    }

    run(
        config.circuitDirs.map(resolveCircuitDirpath),
        buildDirPath,
        tempDirPath,
        port,
        args.no_clobber,
        args.quiet,
    )
}

if (require.main === module) {
    main()
}

export { run, loadSymbols }
