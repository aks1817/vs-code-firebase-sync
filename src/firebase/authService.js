const vscode = require("vscode");
const { initializeApp } = require("firebase/app");
const {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} = require("firebase/auth");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Event emitter for auth state changes
const authStateEmitter = new vscode.EventEmitter();

// Store the current user
let currentUser = null;

// Function to handle Google sign-in
async function signInWithGoogle(context) {
  try {
    const clientId = "";
    const clientSecret = "";
    const redirectUri = "";
    const scope = encodeURIComponent("openid email profile");

    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

    // Open the Google sign-in page in the user's default browser
    await vscode.env.openExternal(vscode.Uri.parse(authUrl));

    // Prompt user to paste the URL after redirection
    const userResponse = await vscode.window.showInputBox({
      prompt: "Paste the redirected URL from your browser after login:",
      placeHolder: "http://localhost:8080/?code=...",
      ignoreFocusOut: true,
    });

    // If user cancels the input box (clicks Escape), just return without showing an error
    if (userResponse === undefined) {
      console.log("User cancelled the authentication flow");
      return false;
    }

    // If user submits an empty string (presses Enter with no input), show error
    if (!userResponse) {
      vscode.window.showErrorMessage(
        "Authentication failed: No input received."
      );
      return false;
    }

    // Extract authorization code from URL
    const urlParams = new URL(userResponse);
    const authCode = urlParams.searchParams.get("code");

    if (!authCode) {
      vscode.window.showErrorMessage(
        "Authentication failed: No authorization code found."
      );
      return false;
    }

    // Exchange authorization code for access and ID tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      vscode.window.showErrorMessage(
        `Authentication error: ${tokenData.error_description}`
      );
      return false;
    }

    // Get the ID token for Firebase authentication
    const idToken = tokenData.id_token;

    if (!idToken) {
      vscode.window.showErrorMessage(
        "Authentication failed: No ID token received."
      );
      return false;
    }

    // Sign in to Firebase with the ID token
    const user = await processAuthToken(idToken, context);

    if (user) {
      // Save auth data to extension storage
      if (context) {
        await context.globalState.update("firebase.user", {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          idToken: idToken,
        });
      }

      // Emit auth state change event
      authStateEmitter.fire(user);

      vscode.window.showInformationMessage(
        "Successfully signed in with Google!"
      );

      // Force UI update
      vscode.commands.executeCommand("firebaseSync.refreshSidebar");
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error during Google sign-in:", error);
    vscode.window.showErrorMessage(`Authentication error: ${error.message}`);
    return false;
  }
}

// Function to handle sign out
async function handleSignOut(context) {
  try {
    await signOut(auth);
    currentUser = null;

    // Clear stored auth data
    if (context) {
      await context.globalState.update("firebase.user", null);
    }

    // Emit auth state change event
    authStateEmitter.fire(null);

    vscode.window.showInformationMessage("Signed out successfully");

    // Force UI update
    vscode.commands.executeCommand("firebaseSync.refreshSidebar");
    return true;
  } catch (error) {
    console.error("Error signing out:", error);
    vscode.window.showErrorMessage(`Sign out error: ${error.message}`);
    return false;
  }
}

// Function to process auth token received from browser
async function processAuthToken(token, context) {
  try {
    // Create a credential with the token
    const credential = GoogleAuthProvider.credential(token);

    // Sign in with credential
    const result = await signInWithCredential(auth, credential);
    currentUser = result.user;

    // Save auth data to extension storage
    if (context) {
      await context.globalState.update("firebase.user", {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        idToken: token,
      });
    }

    // Emit auth state change event
    authStateEmitter.fire(currentUser);

    vscode.window.showInformationMessage(
      `Signed in as ${currentUser.displayName || currentUser.email}`
    );
    return currentUser;
  } catch (error) {
    console.error("Error processing auth token:", error);
    vscode.window.showErrorMessage(`Authentication error: ${error.message}`);
    return null;
  }
}

// Function to get the current user
function getCurrentUser() {
  return currentUser;
}

// Function to restore auth state from storage
async function restoreAuthState(context) {
  try {
    const storedUser = context.globalState.get("firebase.user");

    if (storedUser && storedUser.idToken) {
      console.log("Restoring auth state for user:", storedUser.email);

      // Try to sign in with the stored token
      try {
        await processAuthToken(storedUser.idToken, context);
        return true;
      } catch (error) {
        console.error("Failed to restore auth state:", error);
        // Clear invalid stored data
        await context.globalState.update("firebase.user", null);
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error("Error restoring auth state:", error);
    return false;
  }
}

// Initialize auth state listener
function initAuthStateListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    // Emit auth state change event
    authStateEmitter.fire(user);
  });
}

// Get auth state change event
function getAuthStateChangeEvent() {
  return authStateEmitter.event;
}

module.exports = {
  signInWithGoogle,
  handleSignOut,
  processAuthToken,
  getCurrentUser,
  initAuthStateListener,
  restoreAuthState,
  getAuthStateChangeEvent,
};
