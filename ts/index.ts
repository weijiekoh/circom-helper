import * as argparse from 'argparse'
const version = '1.0.0'

const main = async () => {

    const parser = new argparse.ArgumentParser({ 
        description: 'A convenient way for developers to compile, cache, ' + 
            'and execute circom circuits, as well as to generate proofs.',
    })

    parser.add_argument('-v', '--version', { action: 'version', version });
    console.log(parser.parse_args())
    console.log('hi')
}

if (require.main === module) {
    main()
}
