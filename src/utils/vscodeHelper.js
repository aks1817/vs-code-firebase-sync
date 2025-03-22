const vscode = require("vscode");

function getCurrentWorkspaceFiles() {
  return vscode.workspace
    .findFiles("**/*", "**/node_modules/**")
    .then((files) => files.map((file) => file.fsPath))
    .catch((err) => {
      console.error("Error finding workspace files:", err);
      vscode.window.showErrorMessage("Error finding workspace files.");
      return [];
    });
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
