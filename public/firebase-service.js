import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYzUtguSZ37m2PSyihERhbQ9RjBdNoEtw",
  authDomain: "wms-dashboard-a4ff8.firebaseapp.com",
  projectId: "wms-dashboard-a4ff8",
  storageBucket: "wms-dashboard-a4ff8.firebasestorage.app",
  messagingSenderId: "203002558919",
  appId: "1:203002558919:web:84d8743d5d9a94e08541e2",
  measurementId: "G-VV2Z4H142Q"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

window.itemsWithIssues = new Set();

// Function to initialize and load the list of item codes that have issues
window.initFirebaseIssues = async function() {
    try {
        const q = query(collection(db, "memos"));
        const querySnapshot = await getDocs(q);
        const issues = new Set();
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.itemCode) issues.add(data.itemCode);
        });
        window.itemsWithIssues = issues;
        // Notify the main script to update visuals
        window.dispatchEvent(new Event('firebaseReady'));
    } catch (e) {
        console.error("Firebase init error", e);
    }
};

// Function to upload an image to Firebase Storage
window.uploadIssueImage = async function(file) {
    if (!file) return null;
    const fileName = `issues/\${Date.now()}_\${file.name}`;
    const storageRef = ref(storage, fileName);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

// Function to save a new memo
window.saveIssueMemo = async function(itemCode, date, text, imageUrl) {
    try {
        await addDoc(collection(db, "memos"), {
            itemCode: itemCode,
            date: date,
            text: text,
            imageUrl: imageUrl,
            createdAt: serverTimestamp()
        });
        
        // Add to our local set and update 3D
        window.itemsWithIssues.add(itemCode);
        window.dispatchEvent(new Event('firebaseReady')); // Re-trigger visual update
        return true;
    } catch (e) {
        console.error("Error saving memo", e);
        return false;
    }
};

// Function to fetch memos for a specific item
window.fetchIssueMemos = async function(itemCode) {
    try {
        const q = query(collection(db, "memos"), where("itemCode", "==", itemCode), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const memos = [];
        querySnapshot.forEach((doc) => {
            memos.push({ id: doc.id, ...doc.data() });
        });
        return memos;
    } catch (e) {
        console.error("Error fetching memos", e);
        return [];
    }
};

// Start fetching issues
window.initFirebaseIssues();
