//@ts-check

'use strict';

const path = require('path');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
    target: 'node', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
    mode: 'development', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

    entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
        // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]',
    },
    externals: {
        vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        // modules added here also need to be added in the .vscodeignore file
    },
    resolve: {
        // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
        // alias: {
        //     // Adjust the path to match the actual location of your ".node" files
        //     'node-pty': path.resolve(
        //         __dirname,
        //         'node_modules/node-pty/build/Release/pty.node'
        //     ),
        // },
        extensions: ['.ts', '.js', '.tsx', '.node'],
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                    },
                ],
            },
            {
                test: /\.(dll|exe|bin)$/,
                use: [
                    {
                        loader: 'raw-loader',
                    },
                ],
            },
            // https://github.com/microsoft/vscode/blob/d4d02122bec716c1a86bdb02fe4b69a29c94629c/src/vscode-dts/vscode.proposed.terminalDataWriteEvent.d.ts#L1-L30
            // maybe skip allllll of this and use the proposed api?
            // https://github.com/microsoft/node-pty/issues/582 -- maybe don't do this
            {
                test: /\.node$/,
                exclude: /src/,
                use: [
                    {
                        loader: 'node-loader',
                    },
                ],
            },
        ],
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: 'log', // enables logging required for problem matchers
    },
};
module.exports = [extensionConfig];
