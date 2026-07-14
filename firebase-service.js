import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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

// Function to save a new memo
window.saveIssueMemo = async function(itemCode, date, text) {
    try {
        await addDoc(collection(db, "memos"), {
            itemCode: itemCode,
            date: date,
            text: text,
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
        const q = query(collection(db, "memos"), where("itemCode", "==", itemCode));
        const querySnapshot = await getDocs(q);
        const memos = [];
        querySnapshot.forEach((doc) => {
            memos.push({ id: doc.id, ...doc.data() });
        });
        // Sort in memory by createdAt descending
        memos.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });
        return memos;
    } catch (e) {
        console.error("Error fetching memos", e);
        return [];
    }
};


// Function to delete a memo
window.deleteIssueMemo = async function(memoId, itemCode) {
    try {
        await deleteDoc(doc(db, "memos", memoId));
        
        // Check if there are any memos left for this item
        const q = query(collection(db, "memos"), where("itemCode", "==", itemCode));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            window.itemsWithIssues.delete(itemCode);
            window.dispatchEvent(new Event('firebaseReady'));
        }
        return true;
    } catch (e) {
        console.error("Error deleting memo", e);
        return false;
    }
};

// Function to update a memo
window.updateIssueMemo = async function(memoId, date, text) {
    try {
        await updateDoc(doc(db, "memos", memoId), {
            date: date,
            text: text
        });
        return true;
    } catch (e) {
        console.error("Error updating memo", e);
        return false;
    }
};

// Start fetching issues
window.initFirebaseIssues();
