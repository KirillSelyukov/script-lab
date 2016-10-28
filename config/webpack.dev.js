var webpack = require('webpack');
var webpackMerge = require('webpack-merge');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var commonConfig = require('./webpack.common.js');
var helpers = require('./helpers');

module.exports = webpackMerge(commonConfig, {
    output: {
        path: helpers.root('dist'),
        filename: '[name].[hash].js',
        chunkFilename: '[id].[hash].chunk.js',
        sourceMapFilename: '[name].[hash].map'
    },

    tslint: {
        emitErrors: false,
        failOnHint: false,
        resourcePath: 'src'
    },

    plugins: [
        new webpack.SourceMapDevToolPlugin({
            filename: '[file].[hash].map',
            exclude: [
                'vendor.js',
                'polyfills.js'
            ]
        }),
        new ExtractTextPlugin('[name].[hash].css'),
        new CopyWebpackPlugin([
            {
                from: './config/env.debug.json',
                to: 'env.json',
            }
        ]),
        new HtmlWebpackPlugin({
            template: 'src/index.dev.html'
        }),
    ],

    devServer: {
        historyApiFallback: true,
        stats: 'minimal',
        watchOptions: {
            aggregateTimeout: 300,
            poll: 1000
        },
        outputPath: helpers.root('dist')
    }
});
