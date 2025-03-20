const { db } = require("./firebaseConfig");

async function saveProject(projectName, fileList) {
  await db.collection("projects").doc(projectName).set({ files: fileList });
}

async function getProjects() {
  const snapshot = await db.collection("projects").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function updateProject(projectName, fileList) {
  await db.collection("projects").doc(projectName).update({ files: fileList });
}

async function deleteProject(projectName) {
  await db.collection("projects").doc(projectName).delete();
}

async function syncProjectFiles(projectName, fileList) {
  await db
    .collection("projects")
    .doc(projectName)
    .set({ files: fileList }, { merge: true });
}

module.exports = {
  saveProject,
  getProjects,
  updateProject,
  deleteProject,
  syncProjectFiles,
};
