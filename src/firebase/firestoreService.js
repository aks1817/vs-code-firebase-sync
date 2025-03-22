const vscode = require("vscode");
const admin = require("firebase-admin");

// Get the Firestore instance from the extension.js initialization
const getDb = () => {
  return admin.firestore();
};

async function saveProject(projectName, fileList) {
  try {
    const db = getDb();
    const projectRef = db.collection("projects").doc(projectName);

    // Create a timestamp for tracking when the project was last updated
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Save the project with file list and metadata
    await projectRef.set({
      name: projectName,
      files: fileList,
      fileCount: fileList.length,
      updatedAt: timestamp,
      createdAt: timestamp,
    });

    // Also store individual files as subcollection for better querying
    const batch = db.batch();

    // Delete existing files first (in case of update)
    const existingFiles = await projectRef.collection("files").get();
    existingFiles.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Add new files
    fileList.forEach((filePath) => {
      const fileId = filePath.replace(/[/\\]/g, "_");
      const fileRef = projectRef.collection("files").doc(fileId);
      batch.set(fileRef, {
        path: filePath,
        updatedAt: timestamp,
      });
    });

    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error("Error saving project:", error);
    vscode.window.showErrorMessage(`Error saving project: ${error.message}`);
    throw error;
  }
}

async function getProjects() {
  try {
    const db = getDb();
    const snapshot = await db
      .collection("projects")
      .orderBy("updatedAt", "desc")
      .get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert timestamps to readable format
      updatedAt: doc.data().updatedAt
        ? doc.data().updatedAt.toDate().toLocaleString()
        : "Unknown",
      createdAt: doc.data().createdAt
        ? doc.data().createdAt.toDate().toLocaleString()
        : "Unknown",
    }));
  } catch (error) {
    console.error("Error getting projects:", error);
    vscode.window.showErrorMessage(`Error getting projects: ${error.message}`);
    return [];
  }
}

async function getProjectFiles(projectName) {
  try {
    const db = getDb();
    const filesSnapshot = await db
      .collection("projects")
      .doc(projectName)
      .collection("files")
      .get();

    return filesSnapshot.docs.map((doc) => doc.data().path);
  } catch (error) {
    console.error(`Error getting files for project ${projectName}:`, error);
    vscode.window.showErrorMessage(
      `Error getting project files: ${error.message}`
    );
    return [];
  }
}

async function updateProject(projectName, fileList) {
  try {
    const db = getDb();
    const projectRef = db.collection("projects").doc(projectName);

    // Check if project exists
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      throw new Error(`Project ${projectName} does not exist`);
    }

    // Update the project with new file list and metadata
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    await projectRef.update({
      files: fileList,
      fileCount: fileList.length,
      updatedAt: timestamp,
    });

    // Update individual files in subcollection
    const batch = db.batch();

    // Delete existing files first
    const existingFiles = await projectRef.collection("files").get();
    existingFiles.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Add new files
    fileList.forEach((filePath) => {
      const fileId = filePath.replace(/[/\\]/g, "_");
      const fileRef = projectRef.collection("files").doc(fileId);
      batch.set(fileRef, {
        path: filePath,
        updatedAt: timestamp,
      });
    });

    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error("Error updating project:", error);
    vscode.window.showErrorMessage(`Error updating project: ${error.message}`);
    throw error;
  }
}

async function deleteProject(projectName) {
  try {
    const db = getDb();
    const projectRef = db.collection("projects").doc(projectName);

    // Delete all files in the subcollection first
    const filesSnapshot = await projectRef.collection("files").get();
    const batch = db.batch();

    filesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Then delete the project document
    await projectRef.delete();

    return { success: true };
  } catch (error) {
    console.error("Error deleting project:", error);
    vscode.window.showErrorMessage(`Error deleting project: ${error.message}`);
    throw error;
  }
}

module.exports = {
  saveProject,
  getProjects,
  getProjectFiles,
  updateProject,
  deleteProject,
};
