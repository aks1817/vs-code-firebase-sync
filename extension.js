const vscode = require("vscode");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const SidebarView = require("./src/views/SidebarView");
const { getCurrentWorkspaceFiles } = require("./src/utils/vscodeHelper");
const { getProjectFiles } = require("./src/firebase/firestoreService");
const {
  initAuthStateListener,
  restoreAuthState,
  getAuthStateChangeEvent,
  getCurrentUser,
} = require("./src/firebase/authService");

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

// Initialize auth state listener for client SDK
initAuthStateListener();

function activate(context) {
  console.log("Firebase Sync extension is now active");

  // Register the Sidebar View
  const sidebarView = new SidebarView(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("firebaseSidebar", sidebarView)
  );

  // Create and register the tree data provider
  const treeDataProvider = new FirebaseSyncProvider();
  const treeView = vscode.window.createTreeView("firebaseSidebarTree", {
    treeDataProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // Register refresh command
  const refreshDisposable = vscode.commands.registerCommand(
    "firebaseSync.refresh",
    async () => {
      treeDataProvider.refresh();
    }
  );
  context.subscriptions.push(refreshDisposable);

  // Register refresh sidebar command
  const refreshSidebarDisposable = vscode.commands.registerCommand(
    "firebaseSync.refreshSidebar",
    async () => {
      if (sidebarView) {
        await sidebarView.updateWebviewContent();
      }
    }
  );
  context.subscriptions.push(refreshSidebarDisposable);

  // Register save project command
  const saveProjectDisposable = vscode.commands.registerCommand(
    "firebaseSync.saveProject",
    async () => {
      const projectName = await vscode.window.showInputBox({
        prompt: "Enter project name",
        placeHolder: "My Project",
      });

      if (projectName) {
        const fileList = await getCurrentWorkspaceFiles();
        await sidebarView.saveProject(projectName, fileList);
        treeDataProvider.refresh();
      }
    }
  );
  context.subscriptions.push(saveProjectDisposable);

  // Register update project command
  const updateProjectDisposable = vscode.commands.registerCommand(
    "firebaseSync.updateProject",
    async (projectItem) => {
      let projectName = projectItem?.label;

      if (!projectName) {
        projectName = await vscode.window.showInputBox({
          prompt: "Enter project name to update",
          placeHolder: "My Project",
        });
      }

      if (projectName) {
        const fileList = await getCurrentWorkspaceFiles();
        await sidebarView.updateProject(projectName, fileList);
        treeDataProvider.refresh();
      }
    }
  );
  context.subscriptions.push(updateProjectDisposable);

  // Register delete project command
  const deleteProjectDisposable = vscode.commands.registerCommand(
    "firebaseSync.deleteProject",
    async (projectItem) => {
      let projectName = projectItem?.label;

      if (!projectName) {
        projectName = await vscode.window.showInputBox({
          prompt: "Enter project name to delete",
          placeHolder: "My Project",
        });
      }

      if (projectName) {
        const confirmation = await vscode.window.showWarningMessage(
          `Are you sure you want to delete project "${projectName}"?`,
          { modal: true },
          "Delete",
          "Cancel"
        );

        if (confirmation === "Delete") {
          await sidebarView.deleteProject(projectName);
          treeDataProvider.refresh();
        }
      }
    }
  );
  context.subscriptions.push(deleteProjectDisposable);

  // Subscribe to auth state changes to update the tree view
  const authStateChangeListener = getAuthStateChangeEvent()((user) => {
    treeDataProvider.refresh();
  });
  context.subscriptions.push({
    dispose: () => authStateChangeListener.dispose(),
  });

  // Restore auth state from storage
  restoreAuthState(context).then((success) => {
    if (success) {
      console.log("Auth state restored successfully");
      // Refresh UI components
      vscode.commands.executeCommand("firebaseSync.refreshSidebar");
      vscode.commands.executeCommand("firebaseSync.refresh");
    } else {
      console.log("No stored auth state found or restoration failed");
    }
  });
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
    // Check if user is authenticated
    const currentUser = getCurrentUser();
    if (!currentUser) {
      // If not authenticated, show a message to sign in
      return [
        new vscode.TreeItem(
          "Please sign in to view projects",
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }

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
      const { getProjects } = require("./src/firebase/firestoreService");
      const projects = await getProjects();

      if (projects.length === 0) {
        return [
          new vscode.TreeItem(
            "No projects found",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }

      return projects.map((project) => {
        const item = new vscode.TreeItem(
          project.id,
          vscode.TreeItemCollapsibleState.Collapsed
        );

        // Add metadata to the item
        item.description = `${project.fileCount || 0} files`;
        item.tooltip = `Created: ${project.createdAt}\nUpdated: ${project.updatedAt}`;
        item.contextValue = "project"; // Used for context menu

        // Add project commands
        item.command = {
          command: "firebaseSync.viewProject",
          title: "View Project",
          arguments: [project.id],
        };

        return item;
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        "Error fetching projects: " + error.message
      );
      return [
        new vscode.TreeItem(
          "Error loading projects",
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }
  }

  async getProjectFiles(projectId) {
    try {
      const files = await getProjectFiles(projectId);

      if (files.length === 0) {
        return [
          new vscode.TreeItem(
            "No files found",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }

      // Group files by directory for better organization
      const fileTree = {};
      files.forEach((filePath) => {
        const parts = filePath.split("/");
        let current = fileTree;

        // Create nested structure
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }

        // Add the file
        const fileName = parts[parts.length - 1];
        current[fileName] = null; // null indicates it's a file, not a directory
      });

      // Convert the tree to TreeItems
      return this.buildTreeItems(fileTree);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error fetching files for ${projectId}: ${error.message}`
      );
      return [
        new vscode.TreeItem(
          "Error loading files",
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }
  }

  buildTreeItems(node, prefix = "") {
    const items = [];

    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}/${key}` : key;

      if (value === null) {
        // This is a file
        const item = new vscode.TreeItem(
          key,
          vscode.TreeItemCollapsibleState.None
        );

        // Set the file icon based on extension
        item.resourceUri = vscode.Uri.parse(`file:/${path}`);
        item.tooltip = path;

        items.push(item);
      } else {
        // This is a directory
        const item = new vscode.TreeItem(
          key,
          vscode.TreeItemCollapsibleState.Collapsed
        );

        item.contextValue = "directory";
        item.iconPath = new vscode.ThemeIcon("folder");

        // Add children
        item.children = this.buildTreeItems(value, path);
        items.push(item);
      }
    }

    return items;
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
