const HtmlWebpackPlugin = require('html-webpack-plugin');
const ErrorOverlayPlugin = require('error-overlay-webpack-plugin')
// const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
// const MiniCssExtractPlugin = require("mini-css-extract-plugin");
// const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");

// console.log()

module.exports = (env, argv) => {
  // PRODUCTION will trigger optimization and compile all css into one minified file
  const PRODUCTION = argv.mode ? argv.mode === 'production' : process.env.NODE_ENV === 'production'

  return {
    entry: __dirname + "/src/app.tsx",
    mode: PRODUCTION ? 'production' : 'development',
    target: 'electron-renderer',
    output: {
      filename: "app.js",
      path: __dirname + "/dist"
    },

    // Enable sourcemaps for debugging webpack's output.
    devtool: 'cheap-module-source-map', // "eval-source-map", -- changed for error-overlay-webpack-plugin

    resolve: {
      // Add '.ts' and '.tsx' as resolvable extensions.
      extensions: [".ts", ".tsx", ".js", ".json"]
    },

    module: {
      rules: [
        // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
        {
          test: /\.tsx?$/,
          loader: "ts-loader"
        },

        // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
        {
          test: /\.js$/,
          loader: "source-map-loader",
          enforce: "pre",
        },

        // SASS / SCSS
        {
          test: /\.(sa|sc|c)ss$/,
          use: [
            // PRODUCTION ? MiniCssExtractPlugin.loader : 'style-loader',
            'style-loader',
            'css-loader',
            // {
            //   loader: 'postcss-loader',
            //   // Set up postcss to use the autoprefixer plugin
            //   options: { plugins: () => [require('autoprefixer')] }
            // },
            // 'sass-loader',
          ],
        },
      ]
    },

    // ui-box source maps are not loaded correctly and I do not care to debug
    // this filters out those warnings
    // https://webpack.js.org/loaders/source-map-loader/
    stats: {
      warningsFilter: [/Failed to parse source map/],
    },

    plugins: [
      // new MiniCssExtractPlugin({
      //   // Dynamically support HRM and single file minified css
      //   filename: PRODUCTION ? '[name].[hash].css' : '[name].css',
      //   chunkFilename: PRODUCTION ? '[id].[hash].css' : '[id].css'
      // }),
      new HtmlWebpackPlugin({
        title: 'Pragma',
        template: __dirname + "/src/app.html",
        filename: "index.html"
      }),

      // https://github.com/smooth-code/error-overlay-webpack-plugin
      new ErrorOverlayPlugin(),
    ],

    // Optimizations are enabled when PRODUCTION is true
    optimization: {
      // minimizer: [
      //   new UglifyJsPlugin({
      //     cache: true,
      //     parallel: true,
      //     sourceMap: true // Set to true if you want JS source maps
      //   }),
      //   new OptimizeCSSAssetsPlugin({})
      // ]
    },
    devServer: {
    //   contentBase: path.join(__dirname, 'dist'),
    //   compress: true,
      proxy: {
        '/Users': {
          target: "http://localhost:8001",
        },
      },
      port: 9000
    }
  }
}