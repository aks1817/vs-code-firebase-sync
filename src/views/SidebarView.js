const vscode = require("vscode");
const { getCurrentWorkspaceFiles } = require("../utils/vscodeHelper");
const { getProjects } = require("../firebase/firestoreService");

class SidebarView {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };

    // Initial render
    this.updateWebviewContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "saveProject":
          await this.handleSaveProject(message.projectName);
          break;
        case "updateProject":
          await this.handleUpdateProject(message.projectName);
          break;
        case "deleteProject":
          await this.handleDeleteProject(message.projectName);
          break;
        case "confirmDelete":
          // Handle confirmation in VS Code's native UI
          const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete project "${message.projectName}"?`,
            "Delete",
            "Cancel"
          );

          if (confirmation === "Delete") {
            await this.handleDeleteProject(message.projectName);
          }
          break;
        case "refreshProjects":
          await this.updateWebviewContent();
          break;
      }
    });
  }

  async updateWebviewContent() {
    if (!this.webviewView) return;

    const projects = await getProjects();
    this.webviewView.webview.html = this.getHtmlContent(projects);
  }

  async handleSaveProject(projectName) {
    if (!projectName) {
      vscode.window.showErrorMessage("Please enter a project name");
      return;
    }

    try {
      const fileList = await getCurrentWorkspaceFiles();

      // Format files to just store relative paths
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder is open");
        return;
      }

      const rootPath = workspaceFolders[0].uri.fsPath;
      const relativeFiles = fileList.map((file) => {
        return file
          .replace(rootPath, "")
          .replace(/\\/g, "/")
          .replace(/^\//, "");
      });

      await this.saveProject(projectName, relativeFiles);
      vscode.window.showInformationMessage(
        `Project ${projectName} saved successfully!`
      );
      this.updateWebviewContent();
      this.refreshProjects();
    } catch (error) {
      vscode.window.showErrorMessage(`Error saving project: ${error.message}`);
    }
  }

  async handleUpdateProject(projectName) {
    if (!projectName) {
      vscode.window.showErrorMessage("Please enter a project name");
      return;
    }

    try {
      const fileList = await getCurrentWorkspaceFiles();

      // Format files to just store relative paths
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder is open");
        return;
      }

      const rootPath = workspaceFolders[0].uri.fsPath;
      const relativeFiles = fileList.map((file) => {
        return file
          .replace(rootPath, "")
          .replace(/\\/g, "/")
          .replace(/^\//, "");
      });

      await this.updateProject(projectName, relativeFiles);
      vscode.window.showInformationMessage(
        `Project ${projectName} updated successfully!`
      );
      this.updateWebviewContent();
      this.refreshProjects();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error updating project: ${error.message}`
      );
    }
  }

  async handleDeleteProject(projectName) {
    if (!projectName) {
      vscode.window.showErrorMessage("Please select a project to delete");
      return;
    }

    try {
      // Log for debugging
      console.log(`Deleting project: ${projectName}`);

      await this.deleteProject(projectName);
      vscode.window.showInformationMessage(
        `Project ${projectName} deleted successfully!`
      );

      // Make sure the UI refreshes after deletion
      await this.updateWebviewContent();
      this.refreshProjects();
    } catch (error) {
      console.error(`Error deleting project: ${error.message}`, error);
      vscode.window.showErrorMessage(
        `Error deleting project: ${error.message}`
      );
    }
  }

  getHtmlContent(projects = []) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Firebase Sync</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 10px;
          color: var(--vscode-foreground);
        }
        h2 {
          margin-top: 20px;
          margin-bottom: 10px;
          font-size: 16px;
        }
        input, select {
          width: 100%;
          padding: 8px;
          margin-bottom: 10px;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-radius: 2px;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 12px;
          margin-right: 5px;
          margin-bottom: 10px;
          border-radius: 2px;
          cursor: pointer;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        .project-list {
          margin-top: 20px;
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 2px;
        }
        .project-item {
          padding: 8px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .project-item:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        .project-actions {
          display: flex;
        }
        .project-actions button {
          margin-left: 5px;
          padding: 4px 8px;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <h2>Create/Update Project</h2>
      <input type="text" id="projectName" placeholder="Project Name">
      <div>
        <button id="saveBtn">Save New Project</button>
        <button id="updateBtn">Update Project</button>
      </div>

      <h2>Existing Projects</h2>
      ${projects.length === 0 ? "<p>No projects found</p>" : ""}
      <div class="project-list">
        ${projects
          .map(
            (project) => `
          <div class="project-item">
            <span>${project.id}</span>
            <div class="project-actions">
              <button class="load-btn" data-project="${project.id}">Load</button>
              <button class="vscode-delete-btn" data-project="${project.id}">Delete</button>
            </div>
          </div>
        `
          )
          .join("")}
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        
        // Helper function to setup event listeners
        function setupEventListeners() {
          // Save project
          document.getElementById('saveBtn')?.addEventListener('click', () => {
            const projectName = document.getElementById('projectName').value;
            vscode.postMessage({ command: 'saveProject', projectName });
          });
          
          // Update project
          document.getElementById('updateBtn')?.addEventListener('click', () => {
            const projectName = document.getElementById('projectName').value;
            vscode.postMessage({ command: 'updateProject', projectName });
          });
          
          // Load project name to input
          document.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const projectName = btn.getAttribute('data-project');
              document.getElementById('projectName').value = projectName;
            });
          });
          
          // Delete project - VS Code native confirmation approach
          document.querySelectorAll('.vscode-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              const projectName = btn.getAttribute('data-project');
              
              // Send a request to show confirmation in VS Code UI instead
              vscode.postMessage({ 
                command: 'confirmDelete', 
                projectName 
              });
            });
          });
        }
        
        // Run setup when DOM is fully loaded
        document.addEventListener('DOMContentLoaded', setupEventListeners);
        
        // Also run it immediately in case the DOM is already loaded
        setupEventListeners();
      </script>
    </body>
    </html>`;
  }

  async saveProject(projectName, fileList) {
    const { saveProject } = require("../firebase/firestoreService");
    await saveProject(projectName, fileList);
  }

  async updateProject(projectName, fileList) {
    const { updateProject } = require("../firebase/firestoreService");
    await updateProject(projectName, fileList);
  }

  async deleteProject(projectName) {
    const { deleteProject } = require("../firebase/firestoreService");
    await deleteProject(projectName);
  }

  refreshProjects() {
    vscode.commands.executeCommand("firebaseSync.refresh");
  }
}

module.exports = SidebarView;
