require('module-alias/register')

const definitions = require('@circom-helper/schemas/definitions.json')
import Ajv from 'ajv'

const genValidator = (
    name: string,
) => {
    const schema = require(`@circom-helper/schemas/${name}.json`)

    const ajv = new Ajv()

    ajv.addSchema(definitions)
    ajv.addSchema(schema)

    const validate = ajv.compile(schema)

    return validate
}

export { genValidator }
