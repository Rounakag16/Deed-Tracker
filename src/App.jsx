import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  getDocs,
  deleteDoc,
  setLogLevel,
} from "firebase/firestore";

// --- Firebase Configuration (injected by the environment) ---
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || "{}");
const appId = import.meta.env.VITE_APP_ID || "default-app-id";
const initialAuthToken = import.meta.env.VITE_INITIAL_AUTH_TOKEN || null; 

// --- Initialize Firebase ---
let app;
let auth;
let db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  if (import.meta.env.DEV) setLogLevel("debug");
} catch (e) {
  console.error("Error initializing Firebase:", e);
}

// --- React Context for Tree Management ---
const PageContext = createContext();

// --- Helper Functions ---

const generateId = (prefix = "id") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * Creates a new, complex Deed node object.
 */
const createNewDeedNode = (isRoot = false) => ({
  id: isRoot ? "root" : generateId("deed"),
  title: isRoot ? "New Page" : "New Deed", // Used for page title and node identification
  purchasers: [{ id: generateId("p"), name: "", fatherName: "" }],
  deedInfo: {
    deedNumber: "",
    volumeNumber: "",
    pageNumber: "",
    officeNumber: "",
  },
  landParcels: [
    {
      id: generateId("l"),
      area: "",
      mouja: "",
      sheetNo: "",
      khatiyas: [{ id: generateId("k"), number: "" }],
      plots: [{ id: generateId("pl"), rs: "", lr: "", area: "" }],
    },
  ],
  sellers: [{ id: generateId("s"), name: "", fatherName: "" }],
  children: [],
});

/**
 * Recursively extracts all string/number values from a deed node
 * for searching.
 */
const extractSearchableKeyValues = (node) => {
  let values = [];

  const add = (val) => {
    if (val && typeof val === "string" && val.trim() !== "") {
      values.push(val.trim().toLowerCase());
    } else if (val && typeof val === "number") {
      values.push(val.toString());
    }
  };

  add(node.title);
  node.purchasers.forEach((p) => {
    add(p.name);
    add(p.fatherName);
  });
  node.sellers.forEach((s) => {
    add(s.name);
    add(s.fatherName);
  });

  add(node.deedInfo.deedNumber);
  add(node.deedInfo.volumeNumber);
  add(node.deedInfo.pageNumber);
  add(node.deedInfo.officeNumber);

  node.landParcels.forEach((lp) => {
    add(lp.area);
    add(lp.mouja);
    add(lp.sheetNo);
    lp.khatiyas.forEach((k) => add(k.number));
    lp.plots.forEach((p) => {
      add(p.rs);
      add(p.lr);
      add(p.area);
    });
  });

  // Recursively add children's values
  if (node.children) {
    for (const child of node.children) {
      values = values.concat(extractSearchableKeyValues(child));
    }
  }

  return Array.from(new Set(values)); // Return unique values
};

/**
 * Checks if a SINGLE node's immediate data contains the search term,
 * optionally restricted by a topic.
 */
const checkNodeForTerm = (node, term, topic = "all") => {
  if (!term || !node) return false;
  const lowerTerm = term.toLowerCase();

  const check = (val) => {
    if (val && typeof val === "string" && val.toLowerCase().includes(lowerTerm))
      return true;
    if (val && typeof val === "number" && val.toString().includes(lowerTerm))
      return true;
    return false;
  };

  if (topic === "all" && check(node.title)) return true;

  if (topic === "all" || topic === "purchaser") {
    if (node.purchasers.some((p) => check(p.name) || check(p.fatherName)))
      return true;
  }

  if (topic === "all" || topic === "seller") {
    if (node.sellers.some((s) => check(s.name) || check(s.fatherName)))
      return true;
  }

  if (topic === "all" || topic === "deedNo") {
    if (check(node.deedInfo.deedNumber)) return true;
  }

  if (topic === "all" || topic === "deedInfo") {
    const di = node.deedInfo;
    if (
      check(di.deedNumber) ||
      check(di.volumeNumber) ||
      check(di.pageNumber) ||
      check(di.officeNumber)
    )
      return true;
  }

  if (topic === "all" || topic === "khatiyaNo") {
    if (node.landParcels.some((lp) => lp.khatiyas.some((k) => check(k.number))))
      return true;
  }

  if (topic === "all" || topic === "plotNoRS") {
    if (node.landParcels.some((lp) => lp.plots.some((p) => check(p.rs))))
      return true;
  }

  if (topic === "all" || topic === "plotNoLR") {
    if (node.landParcels.some((lp) => lp.plots.some((p) => check(p.lr))))
      return true;
  }

  if (topic === "all" || topic === "landInfo") {
    for (const lp of node.landParcels) {
      if (check(lp.area) || check(lp.mouja) || check(lp.sheetNo)) return true;
      if (lp.khatiyas.some((k) => check(k.number))) return true;
      if (lp.plots.some((p) => check(p.rs) || check(p.lr) || check(p.area)))
        return true;
    }
  }

  // If topic is 'all', check everything
  if (topic === "all") {
    const di = node.deedInfo;
    if (
      check(di.deedNumber) ||
      check(di.volumeNumber) ||
      check(di.pageNumber) ||
      check(di.officeNumber)
    )
      return true;

    for (const lp of node.landParcels) {
      if (check(lp.area) || check(lp.mouja) || check(lp.sheetNo)) return true;
      if (lp.khatiyas.some((k) => check(k.number))) return true;
      if (lp.plots.some((p) => check(p.rs) || check(p.lr) || check(p.area)))
        return true;
    }
  }

  return false;
};

/**
 * Recursively checks if a node or any of its descendants match the search term & topic.
 */
const checkNodeAndDescendantsForTerm = (node, term, topic) => {
  if (checkNodeForTerm(node, term, topic)) {
    return true;
  }
  if (node.children && node.children.length > 0) {
    return node.children.some((child) =>
      checkNodeAndDescendantsForTerm(child, term, topic)
    );
  }
  return false;
};

/**
 * Immutably finds and updates a node within the tree state.
 */
const updateNodeByPath = (node, path, updateFn) => {
  // Base case: If path is empty, we are at the target node (or the root)
  if (path.length === 0) {
    return updateFn(node);
  }

  // Recursive case: We need to go deeper
  const [nextId, ...remainingPath] = path;

  return {
    ...node,
    children: node.children.map((child) => {
      if (child.id === nextId) {
        // This is the child on our path, recurse
        return updateNodeByPath(child, remainingPath, updateFn);
      }
      return child;
    }),
  };
};

/**
 * Checks if a specific value matches the search term and topic.
 */
const checkMatch = (value, term, topic, myTopic) => {
  const sValue = String(value || "");
  if (!term || !sValue) {
    return false;
  }

  // 1. Check if highlighting is enabled for this topic
  let topicMatches = false;
  if (topic === "all") {
    topicMatches = true;
  } else if (topic === myTopic) {
    topicMatches = true;
  } else if (topic === "purchaser" && myTopic === "purchaser") {
    // Use 'purchaser' for topic
    topicMatches = true;
  } else if (topic === "seller" && myTopic === "seller") {
    // Use 'seller' for topic
    topicMatches = true;
  } else if (
    topic === "deedInfo" &&
    ["deedNo", "volumeNumber", "pageNumber", "officeNumber"].includes(myTopic)
  ) {
    topicMatches = true;
  } else if (
    topic === "landInfo" &&
    [
      "area",
      "mouja",
      "sheetNo",
      "khatiyaNo",
      "plotNoRS",
      "plotNoLR",
      "plotArea",
    ].includes(myTopic)
  ) {
    topicMatches = true;
  }

  if (!topicMatches) {
    return false;
  }

  // 2. Check if the value contains the term
  try {
    const lowerTerm = term.toLowerCase();
    return sValue.toLowerCase().includes(lowerTerm);
  } catch {
    return false;
  }
};

// --- React Components ---

/**
 * A reusable component for editing a list of people (Purchasers/Sellers)
 */
function PeopleEditor({ title, people, onChange }) {
  const handlePersonChange = (id, field, value) => {
    onChange(people.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const addPerson = () => {
    onChange([...people, { id: generateId("p"), name: "", fatherName: "" }]);
  };

  const deletePerson = (id) => {
    if (people.length > 1) {
      // Keep at least one
      onChange(people.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
        {title}
      </h3>
      <div className="space-y-3">
        {people.map((person) => (
          <div key={person.id} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Name"
              value={person.name}
              onChange={(e) =>
                handlePersonChange(person.id, "name", e.target.value)
              }
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-500 dark:text-gray-400">S/O</span>
            <input
              type="text"
              placeholder="Father's Name"
              value={person.fatherName}
              onChange={(e) =>
                handlePersonChange(person.id, "fatherName", e.target.value)
              }
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => deletePerson(person.id)}
              disabled={people.length <= 1}
              className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Delete person"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addPerson}
        className="mt-3 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
      >
        + Add Person
      </button>
    </div>
  );
}

/**
 * Component for editing a list of Khatiya numbers
 */
function KhatiyaEditor({ khatiyas, onChange }) {
  const handleChange = (id, value) => {
    onChange(khatiyas.map((k) => (k.id === id ? { ...k, number: value } : k)));
  };

  const addKhatiya = () => {
    onChange([...khatiyas, { id: generateId("k"), number: "" }]);
  };

  const deleteKhatiya = (id) => {
    if (khatiyas.length > 1) {
      onChange(khatiyas.filter((k) => k.id !== id));
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Khatiya No.
      </label>
      {khatiyas.map((k) => (
        <div key={k.id} className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Khatiya No."
            value={k.number}
            onChange={(e) => handleChange(k.id, e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => deleteKhatiya(k.id)}
            disabled={khatiyas.length <= 1}
            className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-gray-600 disabled:opacity-50"
            aria-label="Delete Khatiya No."
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addKhatiya}
        className="mt-1 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
      >
        + Add Khatiya
      </button>
    </div>
  );
}

/**
 * Component for editing a list of Plots
 */
function PlotEditor({ plots, onChange }) {
  const handleChange = (id, field, value) => {
    onChange(plots.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const addPlot = () => {
    onChange([...plots, { id: generateId("pl"), rs: "", lr: "", area: "" }]);
  };

  const deletePlot = (id) => {
    if (plots.length > 1) {
      onChange(plots.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="space-y-3 mt-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Plot No.
      </label>
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        <span className="col-span-4">RS</span>
        <span className="col-span-4">LR</span>
        <span className="col-span-3">Area</span>
        <span className="col-span-1"></span>
      </div>
      {plots.map((p) => (
        <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
          <input
            type="number"
            placeholder="RS"
            value={p.rs}
            onChange={(e) => handleChange(p.id, "rs", e.target.value)}
            className="col-span-4 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="number"
            placeholder="LR"
            value={p.lr}
            onChange={(e) => handleChange(p.id, "lr", e.target.value)}
            className="col-span-4 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Area"
            value={p.area}
            onChange={(e) => handleChange(p.id, "area", e.target.value)}
            className="col-span-3 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => deletePlot(p.id)}
            disabled={plots.length <= 1}
            className="col-span-1 p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-gray-600 disabled:opacity-50"
            aria-label="Delete Plot"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addPlot}
        className="mt-1 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
      >
        + Add Plot
      </button>
    </div>
  );
}

/**
 * Component for editing a single Land Parcel (the "Right Part")
 */
function LandParcelEditor({ parcel, onChange, onDelete }) {
  const handleChange = (field, value) => {
    onChange({ ...parcel, [field]: value });
  };

  const handleKhatiyaChange = (khatiyas) => {
    onChange({ ...parcel, khatiyas });
  };

  const handlePlotChange = (plots) => {
    onChange({ ...parcel, plots });
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 relative">
      <button
        onClick={onDelete}
        className="absolute -top-2 -right-2 p-0.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
        aria-label="Delete this land parcel"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Area
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="Area (float)"
            value={parcel.area}
            onChange={(e) => handleChange("area", e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mouja
          </label>
          <input
            type="text"
            placeholder="Mouja"
            value={parcel.mouja}
            onChange={(e) => handleChange("mouja", e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sheet No.
          </label>
          <input
            type="number"
            placeholder="Sheet No. (int)"
            value={parcel.sheetNo}
            onChange={(e) => handleChange("sheetNo", e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      <hr className="my-4 border-gray-300 dark:border-gray-600" />
      <KhatiyaEditor
        khatiyas={parcel.khatiyas}
        onChange={handleKhatiyaChange}
      />
      <hr className="my-4 border-gray-300 dark:border-gray-600" />
      <PlotEditor plots={parcel.plots} onChange={handlePlotChange} />
    </div>
  );
}

/**
 * DeedNode: The recursive component to render the deed tree.
 */
function DeedNode({ node, path }) {
  const { updateNodeData, addChildNode, deleteNode } = useContext(PageContext);

  const [deedData, setDeedData] = useState(node);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // When the prop 'node' changes (e.g. from a save or tree reload),
  // update our local state to match.
  useEffect(() => {
    setDeedData(node);
  }, [node]);

  // A single function to update the local state.
  // This is passed to all sub-editors.
  const handleDataChange = (field, value) => {
    const updatedDeed = { ...deedData, [field]: value };
    setDeedData(updatedDeed);
    // Propagate the change up to the main app state
    updateNodeData(path, updatedDeed);
  };

  const handleDeedInfoChange = (field, value) => {
    const updatedDeed = {
      ...deedData,
      deedInfo: { ...deedData.deedInfo, [field]: value },
    };
    setDeedData(updatedDeed);
    updateNodeData(path, updatedDeed);
  };

  const handleLandParcelChange = (id, updatedParcel) => {
    const updatedParcels = deedData.landParcels.map((lp) =>
      lp.id === id ? updatedParcel : lp
    );
    handleDataChange("landParcels", updatedParcels);
  };

  const addLandParcel = () => {
    const newParcel = {
      id: generateId("l"),
      area: "",
      mouja: "",
      sheetNo: "",
      khatiyas: [{ id: generateId("k"), number: "" }],
      plots: [{ id: generateId("pl"), rs: "", lr: "", area: "" }],
    };
    handleDataChange("landParcels", [...deedData.landParcels, newParcel]);
  };

  const deleteLandParcel = (id) => {
    if (deedData.landParcels.length > 1) {
      handleDataChange(
        "landParcels",
        deedData.landParcels.filter((lp) => lp.id !== id)
      );
    }
  };

  const handleAddChild = () => {
    addChildNode(path);
  };

  const handleDelete = () => {
    if (path.length === 0) {
      // Simple browser notification. A modal would be better.
      console.warn("Cannot delete the root node.");
      return;
    }
    deleteNode(path);
  };

  const isRoot = path.length === 0;

  return (
    <div
      className={
        isRoot ? "" : "ml-6 pl-4 border-l border-gray-300 dark:border-gray-600"
      }
    >
      <div className="relative p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        {/* Connector line dot */}
        {!isRoot && (
          <span className="absolute -left-[1.30rem] top-10 w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full border-2 border-white dark:border-gray-800"></span>
        )}

        {/* --- Node Header & Controls --- */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isRoot ? "Page Details" : "Deed"}
            </h2>
            {isRoot && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This is the root deed for the page. Edit its title below.
              </p>
            )}
          </div>
          <div className="flex space-x-2 mt-2 sm:mt-0">
            {!isRoot && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? "Expand" : "Collapse"}
              </button>
            )}
            <button
              onClick={handleAddChild}
              className="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 rounded-full hover:bg-green-200 dark:hover:bg-green-800"
            >
              + Add Child Deed
            </button>
            {!isRoot && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 rounded-full hover:bg-red-200 dark:hover:bg-red-800"
              >
                Delete This Deed
              </button>
            )}
          </div>
        </div>

        {!isCollapsed && (
        <div className="space-y-6">
          {/* Page Title (Root Node Only) */}
          {isRoot && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Page Title
              </label>
              <input
                type="text"
                placeholder="Page Title"
                value={deedData.title}
                onChange={(e) => handleDataChange("title", e.target.value)}
                className="mt-1 w-full px-3 py-2 text-lg font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* --- PURCHASER --- */}
          <PeopleEditor
            title="PURCHASER"
            people={deedData.purchasers}
            onChange={(purchasers) =>
              handleDataChange("purchasers", purchasers)
            }
          />

          {/* --- DEED INFORMATION (Left/Right) --- */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
              DEED INFORMATION
            </h3>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Part */}
              <div className="w-full lg:w-1/3 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Deed Number
                  </label>
                  <input
                    type="number"
                    placeholder="Deed Number (int)"
                    value={deedData.deedInfo.deedNumber}
                    onChange={(e) =>
                      handleDeedInfoChange("deedNumber", e.target.value)
                    }
                    className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Volume Number
                  </label>
                  <input
                    type="number"
                    placeholder="Volume Number (int)"
                    value={deedData.deedInfo.volumeNumber}
                    onChange={(e) =>
                      handleDeedInfoChange("volumeNumber", e.target.value)
                    }
                    className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Page Number
                  </label>
                  <input
                    type="number"
                    placeholder="Page Number (int)"
                    value={deedData.deedInfo.pageNumber}
                    onChange={(e) =>
                      handleDeedInfoChange("pageNumber", e.target.value)
                    }
                    className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Office Number
                  </label>
                  <input
                    type="number"
                    placeholder="Office Number (int)"
                    value={deedData.deedInfo.officeNumber}
                    onChange={(e) =>
                      handleDeedInfoChange("officeNumber", e.target.value)
                    }
                    className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Right Part (Land Parcels) */}
              <div className="w-full lg:w-2/3 space-y-4">
                {deedData.landParcels.map((parcel) => (
                  <LandParcelEditor
                    key={parcel.id}
                    parcel={parcel}
                    onChange={(updatedParcel) =>
                      handleLandParcelChange(parcel.id, updatedParcel)
                    }
                    onDelete={() => deleteLandParcel(parcel.id)}
                  />
                ))}
                <button
                  onClick={addLandParcel}
                  className="mt-3 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                  + Add Land Parcel
                </button>
              </div>
            </div>
          </div>

          {/* --- SELLER --- */}
          <PeopleEditor
            title="SELLER"
            people={deedData.sellers}
            onChange={(sellers) => handleDataChange("sellers", sellers)}
          />
        </div>
        )}

        {/* --- Children Deeds --- */}
        {!isCollapsed && (
        <div className="mt-6 space-y-6">
          {deedData.children &&
            deedData.children.map((childNode) => (
              <DeedNode
                key={childNode.id}
                node={childNode}
                path={[...path, childNode.id]}
              />
            ))}
        </div>
        )}
      </div>
    </div>
  );
}

/**
 * PageView: The main content area showing the active page's tree.
 */
function PageView({
  activePage,
  onSave,
  isSaving,
  saveStatus,
  updateNodeData,
  addChildNode,
  deleteNode,
  onToggleViewMode,
  onDeletePage,
  onExportPage,
}) {
  const { activeTree } = useContext(PageContext) || {}; // Use context, but provide fallback

  if (!activePage || !activeTree) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 p-8 text-center">
        <p>
          Select a page from the list or create a new one to start tracking your
          deeds.
        </p>
      </div>
    );
  }

  // The context provider now passes all necessary functions down to DeedNode
  const pageContextValue = {
    updateNodeData,
    addChildNode,
    deleteNode,
  };

  return (
    <PageContext.Provider value={pageContextValue}>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 backdrop-blur-sm sticky top-0 z-10 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <h2
              className="text-xl font-semibold text-gray-900 dark:text-white truncate"
              title={activeTree.title}
            >
              {activeTree.title || "Untitled Page"}
            </h2>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                saveStatus === "saving"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  : saveStatus === "unsaved"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              }`}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "unsaved"
                  ? "Unsaved changes"
                  : "All changes saved"}
            </span>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
            <button
              onClick={onExportPage}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg shadow-md hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
            >
              Export JSON
            </button>
            <button
              onClick={onDeletePage}
              className="px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg shadow-md hover:bg-red-200 dark:text-red-200 dark:bg-red-900 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            >
              Delete Page
            </button>
            <button
              onClick={onToggleViewMode}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 rounded-lg shadow-md hover:bg-indigo-200 dark:text-indigo-200 dark:bg-indigo-900 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
            >
              View Tree
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Page"}
            </button>
          </div>
        </div>

        {/* Tree Container */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-gray-100 dark:bg-gray-900">
          <DeedNode node={activeTree} path={[]} />
        </div>
      </div>
    </PageContext.Provider>
  );
}

/**
 * Sidebar: Component for page list, search, and page creation.
 */
function Sidebar({
  pages,
  activePageId,
  onSelectPage,
  onCreatePage,
  onSearch,
  searchResults,
  isSearching,
  clearSearch,
  userId,
  isDarkMode,
  onToggleDarkMode,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const pagesToShow = searchResults ? searchResults : pages;

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim().toLowerCase());
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    clearSearch();
  };

  return (
    <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-y-auto print-hide">
      {/* Header & New Page */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Deed Tracker
          </h1>
          <button
            onClick={onToggleDarkMode}
            className="p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "Light mode" : "Dark mode"}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
        <button
          onClick={onCreatePage}
          className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
        >
          + Create New Page
        </button>
      </div>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        className="p-4 border-b border-gray-200 dark:border-gray-700"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Search All Deeds
        </h3>
        <input
          type="text"
          placeholder="Search any name, deed no., khatiya..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex space-x-2 mt-3">
          <button
            type="submit"
            disabled={isSearching}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
          {searchResults && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Page List */}
      <div className="flex-1 overflow-y-auto p-4">
        {searchResults && (
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
            Search Results
          </h4>
        )}
        <ul className="space-y-2">
          {pagesToShow.length === 0 && !searchResults && (
            <li className="text-gray-500 dark:text-gray-400 text-sm">
              No pages yet. Create one!
            </li>
          )}
          {pagesToShow.length === 0 && searchResults && (
            <li className="text-gray-500 dark:text-gray-400 text-sm">
              No pages found matching your search.
            </li>
          )}
          {pagesToShow.map((page) => (
            <li key={page.id}>
              <button
                onClick={() => onSelectPage(page.id)}
                className={`w-full text-left px-3 py-2 rounded-lg truncate ${
                  activePageId === page.id
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {page.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* User ID */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400 break-all">
          User ID: {userId || "Initializing..."}
        </span>
      </div>
    </div>
  );
}

// --- NEW COMPONENT: PeopleViewer (Read-only People List) ---
/**
 * Renders a read-only list of people for the view mode.
 */
function PeopleViewer({ title, people, searchTerm, searchTopic, myTopic }) {
  const getRowClass = (person) => {
    // Check both name and fatherName for a match
    if (
      checkMatch(person.name, searchTerm, searchTopic, myTopic) ||
      checkMatch(person.fatherName, searchTerm, searchTopic, myTopic)
    ) {
      return "bg-green-200 dark:bg-green-800 bg-opacity-75 rounded";
    }
    return "";
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
        {title}
      </h3>
      <div className="space-y-2">
        {people.map((person) => (
          <div
            key={person.id}
            className={`flex items-center space-x-2 text-sm ${getRowClass(
              person
            )}`}
          >
            <span className="flex-1 text-gray-800 dark:text-gray-200">
              {person.name || "N/A"}
            </span>
            <span className="text-gray-500 dark:text-gray-400">S/O</span>
            <span className="flex-1 text-gray-800 dark:text-gray-200">
              {person.fatherName || "N/A"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- MODIFIED COMPONENT: Full Deed Info Viewer ---
/**
 * Renders the full deed info in the "input form" layout (read-only).
 */
function FullDeedInfoViewer({ node, searchTerm, searchTopic }) {
  // Helper function to get row classes
  const getRowClass = (value, myTopic) => {
    if (checkMatch(value, searchTerm, searchTopic, myTopic)) {
      return "bg-green-200 dark:bg-green-800"; // Green highlight for the row
    }
    return ""; // Default
  };

  return (
    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs space-y-4">
      {/* --- PURCHASER (Read-only) --- */}
      <PeopleViewer
        title="PURCHASER"
        people={node.purchasers}
        searchTerm={searchTerm}
        searchTopic={searchTopic}
        myTopic="purchaser"
      />

      {/* --- DEED INFORMATION (Read-only) --- */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        {/* <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">DEED INFORMATION</h3> <-- REMOVED THIS HEADING */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Part */}
          <div className="w-full lg:w-1/3">
            <table className="w-full min-w-full text-left text-gray-700 dark:text-gray-300 text-sm">
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  className={`${getRowClass(
                    node.deedInfo.deedNumber,
                    "deedNo"
                  )} bg-opacity-75`}
                >
                  <td className="px-2 py-1 font-medium bg-gray-100 dark:bg-gray-600/50">
                    Deed No.
                  </td>
                  <td className="px-2 py-1">
                    {node.deedInfo.deedNumber || "N/A"}
                  </td>
                </tr>
                <tr
                  className={`${getRowClass(
                    node.deedInfo.volumeNumber,
                    "volumeNumber"
                  )} bg-opacity-75`}
                >
                  <td className="px-2 py-1 font-medium bg-gray-100 dark:bg-gray-600/50">
                    Volume No.
                  </td>
                  <td className="px-2 py-1">
                    {node.deedInfo.volumeNumber || "N/A"}
                  </td>
                </tr>
                <tr
                  className={`${getRowClass(
                    node.deedInfo.pageNumber,
                    "pageNumber"
                  )} bg-opacity-75`}
                >
                  <td className="px-2 py-1 font-medium bg-gray-100 dark:bg-gray-600/50">
                    Page No.
                  </td>
                  <td className="px-2 py-1">
                    {node.deedInfo.pageNumber || "N/A"}
                  </td>
                </tr>
                <tr
                  className={`${getRowClass(
                    node.deedInfo.officeNumber,
                    "officeNumber"
                  )} bg-opacity-75`}
                >
                  <td className="px-2 py-1 font-medium bg-gray-100 dark:bg-gray-600/50">
                    Office No.
                  </td>
                  <td className="px-2 py-1">
                    {node.deedInfo.officeNumber || "N/A"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Part (Land Parcels) */}
          <div className="w-full lg:w-2/3 space-y-4">
            <h5 className="font-semibold text-gray-800 dark:text-gray-200">
              Land Parcels
            </h5>
            {node.landParcels.map((parcel, index) => (
              <div
                key={parcel.id}
                className="mt-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              >
                <h6 className="font-medium text-gray-700 dark:text-gray-300">
                  Parcel {index + 1}
                </h6>
                <table className="mt-1 w-full min-w-full text-left text-gray-700 dark:text-gray-300 text-sm">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr
                      className={`${getRowClass(
                        parcel.area,
                        "area"
                      )} bg-opacity-75`}
                    >
                      <td className="px-2 py-1 font-medium bg-gray-50 dark:bg-gray-700/50">
                        Area
                      </td>
                      <td className="px-2 py-1">{parcel.area || "N/A"}</td>
                    </tr>
                    <tr
                      className={`${getRowClass(
                        parcel.mouja,
                        "mouja"
                      )} bg-opacity-75`}
                    >
                      <td className="px-2 py-1 font-medium bg-gray-50 dark:bg-gray-700/50">
                        Mouja
                      </td>
                      <td className="px-2 py-1">{parcel.mouja || "N/A"}</td>
                    </tr>
                    <tr
                      className={`${getRowClass(
                        parcel.sheetNo,
                        "sheetNo"
                      )} bg-opacity-75`}
                    >
                      <td className="px-2 py-1 font-medium bg-gray-50 dark:bg-gray-700/50">
                        Sheet No.
                      </td>
                      <td className="px-2 py-1">{parcel.sheetNo || "N/A"}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Khatiyas */}
                <h6 className="font-medium text-gray-700 dark:text-gray-300 mt-2">
                  Khatiyas
                </h6>
                <table className="mt-1 w-full min-w-full text-left text-gray-700 dark:text-gray-300 text-sm">
                  <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-2 py-1">Khatiya No.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {parcel.khatiyas.map((k, kIndex) => (
                      <tr
                        key={k.id}
                        className={`${getRowClass(k.number, "khatiyaNo")} ${
                          kIndex % 2 === 0
                            ? "bg-gray-50 dark:bg-gray-700/50"
                            : "bg-white dark:bg-gray-800"
                        } bg-opacity-75`}
                      >
                        <td className="px-2 py-1">{k.number || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Plots */}
                <h6 className="font-medium text-gray-700 dark:text-gray-300 mt-2">
                  Plots
                </h6>
                <table className="mt-1 w-full min-w-full text-left text-gray-700 dark:text-gray-300 text-sm">
                  <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-2 py-1">RS</th>
                      <th className="px-2 py-1">LR</th>
                      <th className="px-2 py-1">Area</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {parcel.plots.map((p, pIndex) => (
                      <tr
                        key={p.id}
                        className={`${
                          getRowClass(p.rs, "plotNoRS") ||
                          getRowClass(p.lr, "plotNoLR") ||
                          getRowClass(p.area, "plotArea")
                        } ${
                          pIndex % 2 === 0
                            ? "bg-gray-50 dark:bg-gray-700/50"
                            : "bg-white dark:bg-gray-800"
                        } bg-opacity-75`}
                      >
                        <td className="px-2 py-1">{p.rs || "N/A"}</td>
                        <td className="px-2 py-1">{p.lr || "N/A"}</td>
                        <td className="px-2 py-1">{p.area || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- SELLER (Read-only) --- */}
      <PeopleViewer
        title="SELLER"
        people={node.sellers}
        searchTerm={searchTerm}
        searchTopic={searchTopic}
        myTopic="seller"
      />
    </div>
  );
}

// --- NEW COMPONENT: DeedNodeViewerBox (Extracted Content) ---
/**
 * Renders the content box for a node in the view tree.
 */
function DeedNodeViewerBox({
  node,
  searchTerm,
  searchTopic,
  isCompactView,
  isRoot = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if this node, or any child, matches the search term & topic
  const isHighlighted = useMemo(() => {
    if (!searchTerm) return false;
    return checkNodeAndDescendantsForTerm(node, searchTerm, searchTopic);
  }, [node, searchTerm, searchTopic]);

  // This node should be highlighted if it matches directly
  const isDirectHit = useMemo(() => {
    if (!searchTerm) return false;
    return checkNodeForTerm(node, searchTerm, searchTopic);
  }, [node, searchTerm, searchTopic]);

  const showDeedInfo = !isCompactView || (isCompactView && isExpanded);

  const renderSimpleList = (title, items, myTopic) => {
    // Check if any item in the list is a match, to highlight the *row* (the div)
    const hasMatch =
      searchTerm &&
      items.some(
        (p) =>
          checkMatch(p.name, searchTerm, searchTopic, myTopic) ||
          checkMatch(p.fatherName, searchTerm, searchTopic, myTopic)
      );

    return (
      <div
        className={`mt-1 text-sm ${
          hasMatch ? "bg-green-200 dark:bg-green-800 bg-opacity-75 rounded" : ""
        }`}
      >
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          {title}:{" "}
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          {items.length > 0
            ? items.map((p, index) => (
                <React.Fragment key={p.id}>
                  {index > 0 && ", "}
                  <span>{p.name || "N/A"}</span>
                </React.Fragment>
              ))
            : "N/A"}
        </span>
      </div>
    );
  };

  // Check if root title is a match
  const rootTitleHasMatch =
    isRoot &&
    searchTerm &&
    checkMatch(node.title, searchTerm, searchTopic, "all");

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className={`shrink-0 p-3 rounded-lg shadow-md cursor-pointer
        ${
          isDirectHit
            ? "bg-yellow-200 dark:bg-yellow-700 border-2 border-yellow-500"
            : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
        }
        ${isHighlighted && !isDirectHit ? "opacity-100" : ""}
        ${searchTerm && !isHighlighted ? "opacity-30" : ""}
        transition-all duration-300
      `}
      style={{ minWidth: "200px" }}
    >
      <div
        className={`font-bold text-gray-900 dark:text-white ${
          rootTitleHasMatch
            ? "bg-green-200 dark:bg-green-800 bg-opacity-75 rounded"
            : ""
        }`}
      >
        {isRoot ? (
          <span>{node.title}</span>
        ) : (
          <span>{node.purchasers[0]?.name || "New Deed"}</span>
          // The compact view title (purchaser[0].name) will be highlighted by renderSimpleList
        )}
      </div>

      {/* Show Purchaser/Seller info for all nodes, including root */}
      {renderSimpleList("Purchaser(s)", node.purchasers, "purchaser")}
      {renderSimpleList("Seller(s)", node.sellers, "seller")}

      {/* Show full tabular info if expanded or in 'Full Info' mode */}
      {showDeedInfo && (
        <FullDeedInfoViewer
          node={node}
          searchTerm={searchTerm}
          searchTopic={searchTopic}
        />
      )}
    </div>
  );
}

// --- MODIFIED COMPONENT: Horizontal Tree Viewer Node ---
/**
 * HorizontalDeedNodeViewer: Recursive component for the horizontal read-only tree.
 */
function HorizontalDeedNodeViewer({
  node,
  searchTerm,
  searchTopic,
  isCompactView,
  isRoot = false,
}) {
  return (
    <div className="flex items-start my-4">
      {/* The Node Box */}
      <DeedNodeViewerBox
        node={node}
        searchTerm={searchTerm}
        searchTopic={searchTopic}
        isCompactView={isCompactView}
        isRoot={isRoot}
      />

      {/* The Children Container (if children exist) */}
      {node.children && node.children.length > 0 && (
        <div className="flex flex-col justify-center ml-10 pl-10 relative border-l border-gray-400 dark:border-gray-600">
          {/* Horizontal connector line from node to vertical line */}
          <div className="absolute -left-10 top-1/2 w-10 h-px bg-gray-400 dark:bg-gray-600 z-0"></div>

          {node.children.map((childNode) => (
            <HorizontalDeedNodeViewer
              key={childNode.id}
              node={childNode}
              searchTerm={searchTerm}
              searchTopic={searchTopic}
              isCompactView={isCompactView}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- NEW COMPONENT: Vertical Tree Viewer Node (Modified for Tree Structure) ---
/**
 * VerticalDeedNodeViewer: Recursive component for the vertical (top-to-bottom) read-only tree.
 */
function VerticalDeedNodeViewer({
  node,
  searchTerm,
  searchTopic,
  isCompactView,
  isRoot = false,
  depth = 0,
}) {
  const hasChildren = node.children && node.children.length > 0;

  // Calculate dynamic left offset for children to create the tree structure
  const childrenIndent = depth === 0 ? 0 : 4; // Adjust this value as needed for spacing

  return (
    <div className={`relative ${isRoot ? "" : "ml-" + childrenIndent}`}>
      <div className="flex flex-col items-center">
        {/* Node Box */}
        <div className={`relative z-10 ${!isRoot ? "mt-6" : ""}`}>
          {" "}
          {/* Add margin-top for non-root nodes for spacing from parent line */}
          <DeedNodeViewerBox
            node={node}
            searchTerm={searchTerm}
            searchTopic={searchTopic}
            isCompactView={isCompactView}
            isRoot={isRoot}
          />
        </div>

        {hasChildren && (
          <div className="relative flex justify-center w-full">
            {/* Vertical line down from current node to children */}
            <div className="absolute top-0 h-8 w-px bg-gray-400 dark:bg-gray-600 z-0"></div>

            <div className="flex justify-center w-full relative pt-8">
              {/* Horizontal line connecting all children */}
              {node.children.length > 1 && (
                <div
                  className="absolute top-0 h-px bg-gray-400 dark:bg-gray-600 z-0"
                  style={{
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: `calc(100% - ${childrenIndent * 2}px)`, // Adjust width based on indent
                  }}
                ></div>
              )}

              <div
                className={`flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-8 w-full`}
              >
                {node.children.map((childNode) => (
                  <VerticalDeedNodeViewer
                    key={childNode.id}
                    node={childNode}
                    searchTerm={searchTerm}
                    searchTopic={searchTopic}
                    isCompactView={isCompactView}
                    depth={depth + 1}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- MODIFIED COMPONENT: Main Page Viewer Container ---
/**
 * PageViewer: The main container for the horizontal tree view.
 */
function PageViewer({ activeTree, onToggleViewMode }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTopic, setSearchTopic] = useState("all");
  const [isCompactView, setIsCompactView] = useState(true);
  const [treeLayout, setTreeLayout] = useState("horizontal"); // 'horizontal' or 'vertical'

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row justify-between lg:items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 backdrop-blur-sm sticky top-0 z-10 gap-4 print-hide">
        <div className="flex-shrink-0 flex gap-2">
          <button
            onClick={onToggleViewMode}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg shadow-md hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          >
            &larr; Back to Edit
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg shadow-md hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          >
            Print
          </button>
        </div>

        {/* Search Bar & Topic */}
        <div className="flex-1 flex flex-col sm:flex-row gap-2 min-w-0">
          <select
            value={searchTopic}
            onChange={(e) => setSearchTopic(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Fields</option>
            <option value="purchaser">Purchaser</option>
            <option value="seller">Seller</option>
            <option value="deedNo">Deed No.</option>
            <option value="khatiyaNo">Khatiya No.</option>
            <option value="plotNoRS">Plot No. (RS)</option>
            <option value="plotNoLR">Plot No. (LR)</option>
            <option value="deedInfo">All Deed Info</option>
            <option value="landInfo">All Land Info</option>
          </select>
          <input
            type="text"
            placeholder="Search to highlight tree..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* View Layout Toggle */}
        <div className="flex-shrink-0 flex items-center justify-center p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
          <button
            onClick={() => setTreeLayout("horizontal")}
            className={`px-3 py-1 text-sm rounded-md ${
              treeLayout === "horizontal"
                ? "bg-white dark:bg-gray-800 shadow"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Horizontal
          </button>
          <button
            onClick={() => setTreeLayout("vertical")}
            className={`px-3 py-1 text-sm rounded-md ${
              treeLayout === "vertical"
                ? "bg-white dark:bg-gray-800 shadow"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Vertical
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex-shrink-0 flex items-center justify-center p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
          <button
            onClick={() => setIsCompactView(true)}
            className={`px-3 py-1 text-sm rounded-md ${
              isCompactView
                ? "bg-white dark:bg-gray-800 shadow"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Compact
          </button>
          <button
            onClick={() => setIsCompactView(false)}
            className={`px-3 py-1 text-sm rounded-md ${
              !isCompactView
                ? "bg-white dark:bg-gray-800 shadow"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Full Info
          </button>
        </div>
      </div>

      {/* Tree Container */}
      <div className="printable-tree-area flex-1 p-8 overflow-auto bg-gray-100 dark:bg-gray-900">
        {treeLayout === "horizontal" && (
          <HorizontalDeedNodeViewer
            node={activeTree}
            searchTerm={searchTerm}
            searchTopic={searchTopic}
            isCompactView={isCompactView}
            isRoot={true}
          />
        )}
        {treeLayout === "vertical" && (
          <VerticalDeedNodeViewer
            node={activeTree}
            searchTerm={searchTerm}
            searchTopic={searchTopic}
            isCompactView={isCompactView}
            isRoot={true}
          />
        )}
      </div>
    </div>
  );
}

/**
 * App: The main application component.
 */
export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);

  const [pages, setPages] = useState([]); // List of all pages {id, title}
  const [activePageId, setActivePageId] = useState(null);
  const [activeTree, setActiveTree] = useState(null); // The full deed tree object for the active page

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const [isViewMode, setIsViewMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const autoSaveTimerRef = useRef(null);

  const saveStatus = isSaving
    ? "saving"
    : hasUnsavedChanges
      ? "unsaved"
      : "saved";

  const pagesCollectionPath = useMemo(() => {
    if (!isAuthReady || !userId) return null;
    return `/artifacts/${appId}/users/${userId}/pages`;
  }, [isAuthReady, userId]);

  // --- Authentication Effect ---
  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth not initialized.");
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
      } else if (initialAuthToken) {
        try {
          await signInWithCustomToken(auth, initialAuthToken);
        } catch (error) {
          console.error("Error signing in with custom token:", error);
          if (auth) await signInAnonymously(auth);
        }
      } else {
        if (auth) await signInAnonymously(auth);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  // --- Dark mode initialization ---
  useEffect(() => {
    const stored = localStorage.getItem("deed-tracker-dark");
    const prefersDark =
      stored === "true" ||
      (stored === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (prefersDark) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }
  }, []);

  const handleToggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    setIsDarkMode(isDark);
    localStorage.setItem("deed-tracker-dark", String(isDark));
  };

  // --- Page Listner Effect ---
  useEffect(() => {
    if (!pagesCollectionPath || !db) return;
    const q = query(collection(db, pagesCollectionPath));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const pagesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title, // Only fetch title for list
        }));
        setPages(pagesData);
      },
      (error) => {
        console.error("Error listening to pages collection:", error);
      }
    );
    return () => unsubscribe();
  }, [pagesCollectionPath, db]);

  // --- Active Page Loader Effect ---
  // Loads the full tree when the activePageId changes
  useEffect(() => {
    if (!activePageId || !pagesCollectionPath || !db) {
      setActiveTree(null);
      return;
    }

    // We need to fetch the full document data now, not just from the list
    const pageDocRef = doc(db, pagesCollectionPath, activePageId);

    const unsubscribe = onSnapshot(
      pageDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const pageData = docSnap.data();
          if (pageData.treeData) {
            try {
              const parsedTree = JSON.parse(pageData.treeData);
              setActiveTree(parsedTree);
            } catch (e) {
              console.error("Error parsing tree data:", e);
              setActiveTree(createNewDeedNode(true)); // Create new root on parse error
            }
          } else {
            setActiveTree(createNewDeedNode(true)); // Create new root if no treeData
          }
        } else {
          console.warn(
            "Selected page doesn't exist in Firestore:",
            activePageId
          );
          setActivePageId(null); // Deselect
          setIsViewMode(false); // Exit view mode if page disappears
        }
      },
      (error) => {
        console.error("Error fetching active page:", error);
      }
    );

    return () => unsubscribe();
  }, [activePageId, pagesCollectionPath, db]);

  // --- Page & Tree Actions ---

  const handleCreatePage = async () => {
    if (!pagesCollectionPath || !db) return;

    const newPageTitle = `New Page ${pages.length + 1}`;
    const newTree = createNewDeedNode(true);
    newTree.title = newPageTitle;

    try {
      const docRef = await addDoc(collection(db, pagesCollectionPath), {
        title: newPageTitle,
        treeData: JSON.stringify(newTree),
        searchableKeyValues: extractSearchableKeyValues(newTree),
      });
      setHasUnsavedChanges(false);
      setActivePageId(docRef.id);
      setIsViewMode(false);
    } catch (e) {
      console.error("Error creating new page:", e);
    }
  };

  const handleSelectPage = (pageId) => {
    if (pageId === activePageId) return;
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "You have unsaved changes on this page. Switch without saving?"
      )
    ) {
      return;
    }
    setActivePageId(pageId);
    setSearchResults(null);
    setHasUnsavedChanges(false);
    setIsViewMode(false);
  };

  const handleSaveTree = useCallback(async () => {
    if (!pagesCollectionPath || !db || !activePageId || !activeTree) return;

    setIsSaving(true);
    try {
      const pageDocRef = doc(db, pagesCollectionPath, activePageId);
      const pageTitle = activeTree.title || "Untitled Page";

      const treeString = JSON.stringify(activeTree);
      const searchableKVs = extractSearchableKeyValues(activeTree);

      await setDoc(
        pageDocRef,
        {
          title: pageTitle,
          treeData: treeString,
          searchableKeyValues: searchableKVs,
        },
        { merge: true }
      );
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Error saving tree:", e);
    } finally {
      setIsSaving(false);
    }
  }, [pagesCollectionPath, activePageId, activeTree]);

  // Auto-save after edits (debounced)
  useEffect(() => {
    if (!hasUnsavedChanges || !activePageId || !activeTree) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveTree();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, activePageId, activeTree, handleSaveTree]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveTree();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSaveTree]);

  const handleDeletePage = async () => {
    if (!pagesCollectionPath || !db || !activePageId) return;
    if (
      !window.confirm(
        "Delete this page and all its deed data? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, pagesCollectionPath, activePageId));
      setActivePageId(null);
      setActiveTree(null);
      setHasUnsavedChanges(false);
      setIsViewMode(false);
    } catch (e) {
      console.error("Error deleting page:", e);
    }
  };

  const handleExportPage = () => {
    if (!activeTree) return;
    const exportData = {
      title: activeTree.title || "Untitled Page",
      exportedAt: new Date().toISOString(),
      tree: activeTree,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(activeTree.title || "deed-page").replace(/[^\w-]+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSearch = async (searchTerm) => {
    if (!pagesCollectionPath || !db) return;

    setIsSearching(true);
    setSearchResults(null);

    try {
      const snapshot = await getDocs(collection(db, pagesCollectionPath));
      const results = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const titleMatch =
          data.title?.toLowerCase().includes(searchTerm) ?? false;

        let contentMatch = false;
        if (
          data.searchableKeyValues?.some((v) => v.includes(searchTerm))
        ) {
          contentMatch = true;
        }
        if (data.treeData) {
          try {
            const tree = JSON.parse(data.treeData);
            if (checkNodeAndDescendantsForTerm(tree, searchTerm, "all")) {
              contentMatch = true;
            }
          } catch {
            // skip invalid tree data
          }
        }

        if (titleMatch || contentMatch) {
          results.push({ id: docSnap.id, title: data.title });
        }
      });

      setSearchResults(results);
    } catch (e) {
      console.error("Error searching pages:", e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // --- Tree State Mutator Functions (passed via Context) ---

  const updateNodeData = useCallback((path, newNodeData) => {
    setHasUnsavedChanges(true);
    setActiveTree((currentTree) => {
      // Ensure currentTree is not null before trying to update
      if (!currentTree) return createNewDeedNode(true); // Return a new tree if it's null
      const updateFn = () => newNodeData; // Simply replace the old node with the new one
      return updateNodeByPath(currentTree, path, updateFn);
    });
  }, []);

  const addChildNode = useCallback((path) => {
    setHasUnsavedChanges(true);
    setActiveTree((currentTree) => {
      if (!currentTree) return createNewDeedNode(true); // Should not happen if a page is active
      const newNode = createNewDeedNode(false); // false = not a root node
      const updateFn = (node) => ({
        ...node,
        children: [...node.children, newNode],
      });
      return updateNodeByPath(currentTree, path, updateFn);
    });
  }, []);

  const deleteNode = useCallback((path) => {
    if (path.length === 0) return;

    setHasUnsavedChanges(true);
    const parentPath = path.slice(0, -1);
    const nodeIdToDelete = path[path.length - 1];

    setActiveTree((currentTree) => {
      if (!currentTree) return null; // Should not happen
      const updateFn = (parentNode) => ({
        ...parentNode,
        children: parentNode.children.filter(
          (child) => child.id !== nodeIdToDelete
        ),
      });
      return updateNodeByPath(currentTree, parentPath, updateFn);
    });
  }, []);

  if (!isAuthReady || !db) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300">
          Initializing and authenticating...
        </p>
      </div>
    );
  }

  // We provide a fallback for the PageContext to prevent errors
  // before activeTree is loaded.
  const rootContextValue = {
    activeTree,
    updateNodeData,
    addChildNode,
    deleteNode,
  };

  return (
    <>
      {/* --- Print Styles --- */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-tree-area, .printable-tree-area * {
            visibility: visible;
          }
          .printable-tree-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible;
            background: white; /* Ensure printable background */
          }
          .print-hide {
            display: none !important;
          }
          /* Ensure highlights print */
          mark {
            background-color: #a7f3d0 !important; /* light green */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-green-200 {
            background-color: #a7f3d0 !important; /* light green */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-yellow-200 {
            background-color: #fef08a !important;
             -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .border {
             border-color: #ccc !important;
          }
        }
      `}</style>

      <PageContext.Provider value={rootContextValue}>
        <div className="flex h-screen w-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white antialiased">
          <Sidebar
            pages={pages}
            activePageId={activePageId}
            onSelectPage={handleSelectPage}
            onCreatePage={handleCreatePage}
            onSearch={handleSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            clearSearch={() => setSearchResults(null)}
            userId={userId}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />

          {/* CONDITIONAL RENDER: Edit Mode or View Mode */}
          {isViewMode && activeTree ? (
            <PageViewer
              activeTree={activeTree}
              onToggleViewMode={() => setIsViewMode(false)}
            />
          ) : (
            <PageView
              activePage={pages.find((p) => p.id === activePageId)}
              onSave={handleSaveTree}
              isSaving={isSaving}
              saveStatus={saveStatus}
              updateNodeData={updateNodeData}
              addChildNode={addChildNode}
              deleteNode={deleteNode}
              onToggleViewMode={() => setIsViewMode(true)}
              onDeletePage={handleDeletePage}
              onExportPage={handleExportPage}
            />
          )}
        </div>
      </PageContext.Provider>
    </>
  );
}
