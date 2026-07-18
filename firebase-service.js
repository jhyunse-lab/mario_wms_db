import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
window.manufacturersWithIssues = new Set();
window.partnersWithIssues = new Set();

// Function to initialize and load the list of item codes that have issues
window.initFirebaseIssues = async function() {
    try {
        const q = query(collection(db, "memos"));
        const querySnapshot = await getDocs(q);
        const items = new Set();
        const manus = new Set();
        const parts = new Set();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const scopeType = data.scopeType || 'item';
            const scopeKey = data.scopeKey || data.itemCode;
            if (scopeKey) {
                if (scopeType === 'item') {
                    items.add(scopeKey);
                } else if (scopeType === 'manufacturer') {
                    manus.add(scopeKey);
                } else if (scopeType === 'partner') {
                    parts.add(scopeKey);
                }
            }
        });

        window.itemsWithIssues = items;
        window.manufacturersWithIssues = manus;
        window.partnersWithIssues = parts;

        // Notify the main script to update visuals
        window.dispatchEvent(new Event('firebaseReady'));
    } catch (e) {
        console.error("Firebase init error", e);
    }
};

// Upload image to Firebase Storage, return { url, path }
window.uploadMemoImage = async function(file) {
    try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageRef = ref(storage, `memo_images/${timestamp}_${safeName}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return { url, path: snapshot.ref.fullPath };
    } catch (e) {
        console.error("Error uploading image", e);
        return null;
    }
};

// Delete image from Firebase Storage
window.deleteMemoImage = async function(imagePath) {
    try {
        if (!imagePath) return;
        await deleteObject(ref(storage, imagePath));
    } catch (e) {
        console.warn("Could not delete image", e);
    }
};

// Function to save a new memo (with optional image)
window.saveIssueMemo = async function(scopeType, scopeKey, date, text, author, imageUrl, imagePath) {
    try {
        const data = {
            scopeType: scopeType || 'item',
            scopeKey: scopeKey,
            itemCode: scopeType === 'item' ? scopeKey : '', // legacy compat
            date,
            text,
            author: author || "",
            imageUrl: imageUrl || "",
            imagePath: imagePath || "",
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, "memos"), data);
        await window.initFirebaseIssues();
        return true;
    } catch (e) {
        console.error("Error saving memo", e);
        return false;
    }
};

// Function to fetch memos for a specific scope
window.fetchIssueMemos = async function(scopeType, scopeKey) {
    try {
        let memos = [];
        if (!scopeType || scopeType === 'item') {
            // Check both scopeKey and legacy itemCode field
            const q1 = query(collection(db, "memos"), where("scopeKey", "==", scopeKey));
            const snap1 = await getDocs(q1);
            snap1.forEach((doc) => {
                memos.push({ id: doc.id, ...doc.data() });
            });

            const q2 = query(collection(db, "memos"), where("itemCode", "==", scopeKey));
            const snap2 = await getDocs(q2);
            snap2.forEach((doc) => {
                if (!memos.some(m => m.id === doc.id)) {
                    memos.push({ id: doc.id, ...doc.data() });
                }
            });
        } else {
            const q = query(collection(db, "memos"), where("scopeType", "==", scopeType), where("scopeKey", "==", scopeKey));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                memos.push({ id: doc.id, ...doc.data() });
            });
        }

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

// Function to delete a memo (and its image)
window.deleteIssueMemo = async function(memoId, scopeType, scopeKey, imagePath) {
    try {
        if (imagePath) await window.deleteMemoImage(imagePath);
        await deleteDoc(doc(db, "memos", memoId));
        await window.initFirebaseIssues();
        return true;
    } catch (e) {
        console.error("Error deleting memo", e);
        return false;
    }
};

// Function to update a memo
window.updateIssueMemo = async function(memoId, date, text, author, imageUrl, imagePath) {
    try {
        const updateData = { date, text, author: author || "" };
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (imagePath !== undefined) updateData.imagePath = imagePath;
        await updateDoc(doc(db, "memos", memoId), updateData);
        await window.initFirebaseIssues();
        return true;
    } catch (e) {
        console.error("Error updating memo", e);
        return false;
    }
};

// Start fetching issues
window.initFirebaseIssues();
