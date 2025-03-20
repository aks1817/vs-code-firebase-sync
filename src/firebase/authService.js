const vscode = require("vscode");
const firebase = require("firebase/app");
const {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} = require("firebase/auth");
const { firebaseConfig } = require("./firebaseConfig");

firebase.initializeApp(firebaseConfig);
const auth = getAuth();
const provider = new GoogleAuthProvider();

async function login() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    vscode.window.showInformationMessage(`Logged in as ${user.email}`);
    return user;
  } catch (error) {
    vscode.window.showErrorMessage(`Login Failed: ${error.message}`);
    return null;
  }
}

async function logout() {
  try {
    await signOut(auth);
    vscode.window.showInformationMessage("Logged out successfully.");
  } catch (error) {
    vscode.window.showErrorMessage(`Logout Failed: ${error.message}`);
  }
}

module.exports = { login, logout, auth };
