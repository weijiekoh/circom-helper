import * as fs from 'fs'
import * as path from 'path'
//require('module-alias/register')

//const definitions = require('@circom-helper/schemas/definitions.json')
const definitions = JSON.parse(
    fs.readFileSync(
        path.join(
            __dirname,
            '..',
            '..',
            '..',
            'schemas',
            'definitions.json',
        ),
    ).toString(),
)
import Ajv from 'ajv'

const genValidator = (
    name: string,
) => {
    //const schema = require(`@circom-helper/schemas/${name}.json`)
    const schema = JSON.parse(
        fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'schemas',
                name + '.json',
            ),
        ).toString()
    )

    const ajv = new Ajv()

    ajv.addSchema(definitions)
    ajv.addSchema(schema)

    const validate = ajv.compile(schema)

    return validate
}

export { genValidator }
