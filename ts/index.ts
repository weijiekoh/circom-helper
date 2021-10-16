#!/usr/bin/env node

const betterSqlite3 = require('better-sqlite3')
const lineByLine = require('n-readlines')
import * as argparse from 'argparse'
import * as fs from 'fs'
import * as path from 'path'
import * as shelljs from 'shelljs'
import { launchServer } from './server'
import {
    genWitness,
    getSignalByName,
} from './utils'

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
    skip = false,
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
        path.join(path.resolve(buildDir), withoutExtension + '_cpp')
    const symFilepath = 
        path.join(path.resolve(buildDir), withoutExtension + '.sym')
    const witnessGenFilepath
        = path.join( path.resolve(buildDir), withoutExtension)

    const buildDirContents = fs.readdirSync(buildDir)
    if (noClobber) {
        let skip = true
        for (const f of [
            r1csFilepath,
            cFilepath,
            symFilepath,
            witnessGenFilepath,
        ]) {
            if (buildDirContents.indexOf(path.basename(f)) === -1) {
                skip = false
                break
            }
        }
        
        if (skip) {
            log(`Skipping ${filepath}`)
            return { 
                r1csFilepath,
                symFilepath,
                witnessGenFilepath,
            }
        }
    }
    if (!skip) {
        log(`Compiling ${filepath}`)
        let cmd = `${circomPath} --r1cs --c --sym -o ${path.resolve(buildDir)} ${filepath}`
        console.log(cmd)

        const compileOut = shelljs.exec(cmd, {silent: true})
        if (compileOut.stderr || compileOut.code === 1) {
            console.error(compileOut.stderr)
            throw new Error('Could not compile ' + circomPath)
        }

        const srcs = 
            path.join(path.resolve(buildDir), 'main.cpp') + ' ' +
            path.join(path.resolve(buildDir), 'calcwit.cpp') + ' ' +
            path.join(path.resolve(buildDir), 'utils.cpp') + ' ' +
            path.join(path.resolve(buildDir), 'fr.cpp') + ' ' +
            path.join(path.resolve(buildDir), 'fr.o')
        cmd = `g++ -pthread ${srcs} ` +
            `${cFilepath} -o ${witnessGenFilepath} ` + 
            `-lgmp -std=c++11 -O3 -fopenmp -DSANITY_CHECK`

        shelljs.cd(
            path.join(
                path.resolve(buildDir),
                withoutExtension + '_cpp',
            ),
        )

        const makeCmdOut = shelljs.exec('make', {silent: true})

        if (makeCmdOut.stderr) {
            console.error(
                'Error running the make command. Please check if all ' + 
                'dependencies are present.'
            )
            console.error(cmd)
            console.error(makeCmdOut.stderr)
        }

        shelljs.mv(
            path.join(
                path.resolve(buildDir),
                withoutExtension + '_cpp',
                withoutExtension,
            ),
            path.resolve(buildDir),
        )

        shelljs.mv(
            path.join(
                path.resolve(buildDir),
                withoutExtension + '_cpp',
                withoutExtension + '.dat',
            ),
            path.resolve(buildDir),
        )
    }

    return { 
        r1csFilepath,
        symFilepath,
        witnessGenFilepath,
    }
}

const run = async (
    circomPath: string,
    snarkjsPath: string,
    circuitDirs: string[],
    buildDir: string,
    port: number,
    noClobber: boolean,
    quiet: boolean,
    compileOnly = false,
    skipAll = false,
) => {
    const log = (s: string) => {
        if (!quiet) {
            console.log(s)
        }
    }

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
        const filepaths = compile(circomPath, f, buildDir, noClobber, quiet, skipAll)
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

    // Iterate through the .sym files and save signals in a DB
    console.log('Caching circuit symbols and indices...')
    const db = new betterSqlite3(':memory:')
    db.exec('CREATE TABLE symbols (circuit TEXT, idx INTEGER, name TEXT)')

    const stmt = db.prepare('INSERT INTO symbols (circuit, idx, name) VALUES (?, ?, ?)')
    for (const file of fs.readdirSync(buildDir)) {
        if (file.endsWith('.sym')) {
            const circuit = file.slice(0, file.length - '.sym'.length)
            const symFile = path.join(buildDir, file)
            const liner = new lineByLine(symFile)
            let line
            let lineNumber = 0
            let index

            while (line = liner.next()) {
                line = line.toString()
                const vals = line.split(',')
                if (vals.length > 2) {
                    const idx = Number(vals[1])
                    const name = vals[3]
                    stmt.run(circuit, idx, name)
                }
            }
        }
    }

    if (compileOnly) {
        return
    }

    const circuitBasename = (f: any) => {
        const l = f.r1csFilepath.length
        return path.basename(
            f.r1csFilepath.slice(0, l - '.r1cs'.length)
        )
    }

    const witnessGeneratorExes: any = {}
    for (const f of files) {
        const baseName = circuitBasename(f)

        witnessGeneratorExes[baseName] = baseName
    }

    // Launch the server
    log(`Launched JSON-RPC server at port ${port}`)
    const state = {
        snarkjsPath,
        numInputsPerCircuit,
        buildDir,
        witnessGeneratorExes,
        db,
    }

    return launchServer(port, state)
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
        '-k', '--skip-all',
        { 
            required: false,
            action: 'store_true', 
            help: 'Launch the JSON-RPC server without compilation or checking if any circuits exist',
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

    run(
        circomPath,
        snarkjsPath,
        config.circuitDirs.map(resolveCircuitDirpath),
        buildDirPath,
        port,
        args.no_clobber,
        args.quiet,
        args.compile_only,
        args.skip_all,
    )
}

if (require.main === module) {
    main()
}

export {
    run,
    genWitness as callGenWitness,
    getSignalByName as callGetSignalByName,
}
