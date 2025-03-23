const vscode = require("vscode");
const { getCurrentWorkspaceFiles } = require("../utils/vscodeHelper");
const { getProjects } = require("../firebase/firestoreService");
const {
  signInWithGoogle,
  handleSignOut,
  processAuthToken,
  getCurrentUser,
  getAuthStateChangeEvent,
} = require("../firebase/authService");

class SidebarView {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    // Subscribe to auth state changes
    this.authStateChangeListener = getAuthStateChangeEvent()((user) => {
      this.updateWebviewContent();
    });
  }

  resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };

    // Initial render
    this.updateWebviewContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "signIn":
          await signInWithGoogle(this.context);
          break;
        case "signOut":
          await handleSignOut(this.context);
          break;
        case "authCallback":
          await processAuthToken(message.token, this.context);
          break;
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

    try {
      const currentUser = getCurrentUser();
      // Only fetch projects if user is authenticated
      const projects = currentUser ? await getProjects() : [];
      this.webviewView.webview.html = this.getHtmlContent(
        projects,
        currentUser
      );
    } catch (error) {
      console.error("Error updating webview content:", error);
      // Show a simplified error view
      this.webviewView.webview.html = this.getErrorHtmlContent(error);
    }
  }

  getErrorHtmlContent(error) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Firebase Sync</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 16px;
          color: var(--vscode-foreground);
        }
        .error-container {
          padding: 16px;
          background-color: var(--vscode-inputValidation-errorBackground);
          border: 1px solid var(--vscode-inputValidation-errorBorder);
          color: var(--vscode-inputValidation-errorForeground);
          margin-bottom: 16px;
          border-radius: 4px;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 12px;
          border-radius: 2px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h3>Error Loading Content</h3>
        <p>${error.message || "An unknown error occurred"}</p>
      </div>
      <button id="retryBtn">Retry</button>
      
      <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('retryBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'refreshProjects' });
        });
      </script>
    </body>
    </html>`;
  }

  getHtmlContent(projects = [], currentUser = null) {
    const authSection = currentUser
      ? `
        <div class="user-info">
          <img src="${
            currentUser.photoURL || ""
          }" alt="Profile" class="profile-pic">
          <span class="user-name">${
            currentUser.displayName || currentUser.email
          }</span>
          <button id="signOutBtn" class="action-button">Sign Out</button>
        </div>
      `
      : `
        <div class="auth-section">
          <h2 class="section-title">Firebase Sync</h2>
          <p class="description">Sync your VS Code projects with Firebase</p>
          <button id="signInBtn" class="google-btn">
            <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google logo">
            Sign in with Google
          </button>
        </div>
      `;

    const projectSection = currentUser
      ? `
        <div class="section">
          <h2 class="section-title">Create/Update Project</h2>
          <div class="input-group">
            <input type="text" id="projectName" placeholder="Project Name" class="input-field">
            <div class="button-group">
              <button id="saveBtn" class="action-button primary">Save New</button>
              <button id="updateBtn" class="action-button">Update</button>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">Existing Projects</h2>
          ${
            projects.length === 0
              ? "<p class='empty-message'>No projects found</p>"
              : ""
          }
          <div class="project-list">
            ${projects
              .map(
                (project) => `
              <div class="project-item">
                <span class="project-name">${project.id}</span>
                <div class="project-actions">
                  <button class="load-btn action-button small" data-project="${project.id}">Load</button>
                  <button class="vscode-delete-btn action-button small danger" data-project="${project.id}">Delete</button>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
      : ``;

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Firebase Sync</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 16px;
          color: var(--vscode-foreground);
          margin: 0;
        }
        
        /* Typography */
        .section-title {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 18px;
          font-weight: 600;
          color: var(--vscode-foreground);
        }
        
        .description {
          margin-bottom: 20px;
          color: var(--vscode-descriptionForeground);
          font-size: 14px;
        }
        
        .empty-message {
          color: var(--vscode-descriptionForeground);
          font-style: italic;
          margin: 16px 0;
        }
        
        /* Sections */
        .section {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        /* Form elements */
        .input-group {
          margin-bottom: 16px;
        }
        
        .input-field {
          width: 100%;
          padding: 8px 10px;
          margin-bottom: 12px;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-radius: 4px;
          font-size: 14px;
        }
        
        .input-field:focus {
          outline: 2px solid var(--vscode-focusBorder);
          border-color: transparent;
        }
        
        .button-group {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        /* Buttons */
        .action-button {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        
        .action-button:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .action-button.primary {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        
        .action-button.primary:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        
        .action-button.danger {
          background-color: var(--vscode-errorForeground);
          color: white;
        }
        
        .action-button.danger:hover {
          opacity: 0.9;
        }
        
        .action-button.small {
          padding: 4px 8px;
          font-size: 12px;
        }
        
        /* Google button */
        .google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 10px 16px;
          background-color: white;
          color: #757575;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .google-btn:hover {
          background-color: #f5f5f5;
        }
        
        .google-btn img {
          width: 18px;
          height: 18px;
          margin-right: 12px;
        }
        
        /* User info */
        .user-info {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          padding: 12px;
          border-radius: 4px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
        }
        
        .profile-pic {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          margin-right: 12px;
          background-color: var(--vscode-button-background);
        }
        
        .user-name {
          flex: 1;
          font-weight: 500;
        }
        
        /* Project list */
        .project-list {
          margin-top: 12px;
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
        }
        
        .project-item {
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .project-item:last-child {
          border-bottom: none;
        }
        
        .project-item:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        
        .project-name {
          font-weight: 500;
        }
        
        .project-actions {
          display: flex;
          gap: 6px;
        }
        
        /* Auth section */
        .auth-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px 0;
        }
      </style>
    </head>
    <body>
      ${authSection}
      ${projectSection}

      <script>
        const vscode = acquireVsCodeApi();
        
        // Helper function to setup event listeners
        function setupEventListeners() {
          // Auth related listeners
          const signInBtn = document.getElementById('signInBtn');
          if (signInBtn) {
            signInBtn.addEventListener('click', () => {
              vscode.postMessage({ command: 'signIn' });
            });
          }
          
          const signOutBtn = document.getElementById('signOutBtn');
          if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
              vscode.postMessage({ command: 'signOut' });
            });
          }
          
          // Save project
          const saveBtn = document.getElementById('saveBtn');
          if (saveBtn) {
            saveBtn.addEventListener('click', () => {
              const projectName = document.getElementById('projectName').value;
              if (!projectName) {
                alert('Please enter a project name');
                return;
              }
              vscode.postMessage({ command: 'saveProject', projectName });
            });
          }
          
          // Update project
          const updateBtn = document.getElementById('updateBtn');
          if (updateBtn) {
            updateBtn.addEventListener('click', () => {
              const projectName = document.getElementById('projectName').value;
              if (!projectName) {
                alert('Please enter a project name');
                return;
              }
              vscode.postMessage({ command: 'updateProject', projectName });
            });
          }
          
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

  dispose() {
    // Clean up the auth state change listener
    if (this.authStateChangeListener) {
      this.authStateChangeListener.dispose();
    }
  }
}

module.exports = SidebarView;
