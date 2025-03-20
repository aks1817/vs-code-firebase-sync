const vscode = require("vscode");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Load Firebase credentials (make sure this file is present)
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  vscode.window.showErrorMessage("Missing serviceAccountKey.json file!");
}

const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function activate(context) {
  // Register the Sidebar View
  const treeDataProvider = new FirebaseSyncProvider();
  vscode.window.registerTreeDataProvider("firebaseSidebar", treeDataProvider);

  // Register refresh command
  let disposable = vscode.commands.registerCommand(
    "firebaseSync.refresh",
    async () => {
      treeDataProvider.refresh();
      vscode.window.showInformationMessage("Firebase Sync Refreshed!");
    }
  );

  context.subscriptions.push(disposable);
}

class FirebaseSyncProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      // Fetch top-level projects
      return this.getProjects();
    } else {
      // Fetch files inside a project
      return this.getProjectFiles(element.label);
    }
  }

  async getProjects() {
    try {
      const snapshot = await db.collection("projects").get();
      if (snapshot.empty) {
        return [
          new vscode.TreeItem(
            "No projects found",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }

      return snapshot.docs.map((doc) => {
        const item = new vscode.TreeItem(
          doc.id,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.contextValue = "project"; // Used for commands later
        return item;
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        "Error fetching projects: " + error.message
      );
      return [];
    }
  }

  async getProjectFiles(projectId) {
    try {
      const filesSnapshot = await db
        .collection("projects")
        .doc(projectId)
        .collection("files")
        .get();

      if (filesSnapshot.empty) {
        return [
          new vscode.TreeItem(
            "No files found",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }

      return filesSnapshot.docs.map((doc) => {
        const item = new vscode.TreeItem(
          doc.id,
          vscode.TreeItemCollapsibleState.None
        );
        item.command = {
          command: "firebaseSync.downloadFile",
          title: "Download File",
          arguments: [projectId, doc.id],
        };
        return item;
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error fetching files for ${projectId}: ${error.message}`
      );
      return [];
    }
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
