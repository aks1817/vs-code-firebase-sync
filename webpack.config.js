const path = require("path");

module.exports = {
  mode: "development", // Set to "production" for final build
  target: "node", // Ensures compatibility with VS Code's Node.js runtime
  entry: "./extension.js", // The main entry point
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: [".js"],
    alias: {
      "@src": path.resolve(__dirname, "src"), // Use '@src' for cleaner imports
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode", // Exclude VS Code API from Webpack bundling
  },
};
