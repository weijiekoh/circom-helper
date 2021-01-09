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
    circomPath: string,
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
    const witnessGenFilepath
        = path.join( path.resolve(buildDir), withoutExtension)

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
    let cmd = `NODE_OPTIONS=--max-old-space-size=4096 node ${circomPath} ` +
        `${filepath} -r ${r1csFilepath} -c ${cFilepath} -w ${wasmFilepath} ` +
        `-t ${watFilepath} -s ${symFilepath}`
    shelljs.exec(cmd, {silent: true})

    const srcs = 
        path.join(path.resolve(buildDir), 'main.cpp') + ' ' +
        path.join(path.resolve(buildDir), 'calcwit.cpp') + ' ' +
        path.join(path.resolve(buildDir), 'utils.cpp') + ' ' +
        path.join(path.resolve(buildDir), 'fr.cpp') + ' ' +
        path.join(path.resolve(buildDir), 'fr.o')
    cmd = `g++ -pthread ${srcs} ` +
        `${cFilepath} -o ${witnessGenFilepath} ` + 
        `-lgmp -std=c++11 -O3 -fopenmp -DSANITY_CHECK`
    shelljs.exec(cmd, {silent: true})

    return { r1csFilepath, wasmFilepath, symFilepath, watFilepath, witnessGenFilepath }
}

const run = async (
    circomPath: string,
    snarkjsPath: string,
    circomRuntimePath: string,
    ffiasmPath: string,
    circuitDirs: string[],
    buildDir: string,
    port: number,
    noClobber: boolean,
    quiet: boolean,
    compileOnly = false,
) => {
    const log = (s: string) => {
        if (!quiet) {
            console.log(s)
        }
    }

    // Copy .cpp and .hpp files
    let cppPath = path.join(
        circomRuntimePath,
        'c',
        '*.cpp'
    )
    const target = path.resolve(buildDir)
    let cmd
    cmd = `cp ${cppPath} ${target}`
    shelljs.exec(cmd)

    let hppPath = path.join(
        circomRuntimePath,
        'c',
        '*.hpp'
    )
    cmd = `cp ${hppPath} ${target}`
    shelljs.exec(cmd)

    const buildZqFieldPath = path.join(
        ffiasmPath,
        'src',
        'buildzqfield.js',
    )
    cmd = `node ${buildZqFieldPath} -q 21888242871839275222246405745257275088548364400416034343698204186575808495617 -n Fr`
    shelljs.exec(cmd)

    cmd = `mv fr.asm fr.cpp fr.hpp ${target}`
    shelljs.exec(cmd)

    const frAsmPath = path.join(
        target,
        'fr.asm',
    )
    cmd = `nasm -felf64 ${frAsmPath}`
    shelljs.exec(cmd)

    // For each circom file in each circuit dir, compile its circom files
    const filesToCompile: string[] = []
    const d: any = {}
    const numInputsPerCircuit: any = {}
    for (const c of circuitDirs) {
        for (const file of fs.readdirSync(c)) {
            if (file.endsWith(CIRCOM_FILE_EXTENSION)) {
                const fp = path.join(path.resolve(c), file)
                filesToCompile.push(fp)
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
        const filepaths = compile(circomPath, f, buildDir, noClobber, quiet)
        const cmd = `node ${snarkjsPath} r1cs info ${filepaths.r1csFilepath}`
        const output = shelljs.exec(cmd, {silent: true})
        let numInputs = 0
        const m1 = output.match(/# of Private Inputs: (\d+)/)
        const m2 = output.match(/# of Public Inputs: (\d+)/)
        if (m1) {
            numInputs += Number(m1[1])
        }
        if (m2) {
            numInputs += Number(m2[1])
        }
        const bn = path.basename(f)
        const circuitName = bn.slice(0, bn.length - 7)
        numInputsPerCircuit[circuitName] =  numInputs

        const end = Date.now()

        const duration = Math.round((end - start) / 1000)

        log(`Took ${duration} seconds`)

        files.push(filepaths)
    }

    if (compileOnly) {
        return
    }

    const circuitBasename = (f: any) => {
        const l = f.wasmFilepath.length
        return path.basename(
            f.wasmFilepath.slice(0, l - '.wasm'.length)
        )
    }

    // Load symbol files
    log('Loading SYM files to memory...')
    const witnessGeneratorExes: any = {}
    const symbols: any = {}
    for (const f of files) {
        const baseName = circuitBasename(f)

        witnessGeneratorExes[baseName] = baseName

        const syms = loadSymbols(f.symFilepath)
        symbols[baseName] = syms
    }

    // Launch the server
    log(`Launched JSON-RPC server at port ${port}`)
    const state = {
        numInputsPerCircuit,
        buildDir,
        witnessGeneratorExes,
        symbols,
    }

    return launchServer(port, state)
}

const compileWasm = async (
    wasmFilepath: string,
) => {
    const fdWasm = await fastFile.readExisting(wasmFilepath)
    const wasm = await fdWasm.read(fdWasm.totalSize)
    await fdWasm.close()

    const options = {
        sanityCheck: true,
    }
    const wc = await WitnessCalculatorBuilder(wasm, options)
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
        '-y', '--compile-only',
        { 
            required: false,
            action: 'store_true', 
            help: 'Only compile circuits and do not launch the JSON-RPC server',
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

    // Resolve each circuitDir relative to the config filepath
    const resolveCircuitDirpath = (c: string) => {
        const baseDir = path.dirname(configFilepath)
        return path.join(baseDir, c)
    }

    const circomPath = path.join(
        path.dirname(configFilepath),
        config.circom,
    )

    const snarkjsPath = path.join(
        path.dirname(configFilepath),
        config.snarkjs,
    )

    const circomRuntimePath = path.join(
        path.dirname(configFilepath),
        config.circom_runtime,
    )

    const ffiasmPath = path.join(
        path.dirname(configFilepath),
        config.ffiasm,
    )

    run(
        circomPath,
        snarkjsPath,
        circomRuntimePath,
        ffiasmPath,
        config.circuitDirs.map(resolveCircuitDirpath),
        buildDirPath,
        port,
        args.no_clobber,
        args.quiet,
        args.compile_only,
    )
}

if (require.main === module) {
    main()
}

export { run, loadSymbols }
