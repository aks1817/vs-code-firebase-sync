const vscode = require("vscode");

function getCurrentWorkspaceFiles() {
  return vscode.workspace
    .findFiles("**/*", "**/node_modules/**")
    .then((files) => files.map((file) => file.fsPath));
}

function getOpenFiles() {
  return vscode.window.visibleTextEditors.map(
    (editor) => editor.document.uri.fsPath
  );
}

function registerFileChangeListener(callback) {
  return vscode.workspace.onDidOpenTextDocument((doc) => {
    callback(getOpenFiles());
  });
}

module.exports = {
  getCurrentWorkspaceFiles,
  getOpenFiles,
  registerFileChangeListener,
};
