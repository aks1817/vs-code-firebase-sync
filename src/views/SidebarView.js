const vscode = require("vscode");
const { login, logout } = require("../firebase/authService");

class SidebarView {
  constructor(context) {
    this.context = context;
  }

  resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtmlContent();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "login") {
        const user = await login();
        if (user) {
          webviewView.webview.postMessage({
            type: "authStatus",
            email: user.email,
          });
        }
      }
      if (message.command === "logout") {
        await logout();
        webviewView.webview.postMessage({
          type: "authStatus",
          email: "Not logged in",
        });
      }
    });
  }

  getHtmlContent() {
    return `<!DOCTYPE html>
    <html>
    <body>
      <h1>Firebase Sync</h1>
      <button onclick="sendMessage('login')">Login</button>
      <p id="userInfo">Not logged in</p>
      <button onclick="sendMessage('logout')">Logout</button>
    </body>
    </html>`;
  }
}

module.exports = SidebarView;
