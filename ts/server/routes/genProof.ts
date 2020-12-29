import axios from 'axios'
import * as errors from '../errors'
import { genValidator } from './utils'

//const route = async ({ circuit, witness }, _: any) => {
const route = async (_: any) => {
    return { proof: '0x0' }
}

const echoRoute = {
    route,
    reqValidator: genValidator('gen_proof'),
}

export default echoRoute
