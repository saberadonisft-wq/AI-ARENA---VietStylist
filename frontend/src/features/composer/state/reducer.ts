import type { ComposerState } from "./types";
import type { OutfitSpecV2, OutfitSelection, ComposerBundle, EducationProjection } from "@/lib/types/v3";

export type ComposerAction =
  | { type: "LOAD_OUTFIT"; outfit: OutfitSpecV2 }
  | { type: "ADD_SELECTION"; selection: OutfitSelection }
  | { type: "REMOVE_SELECTION"; selectionId: string }
  | { type: "SET_STYLE"; selectionId: string; patch: Record<string, unknown> }
  | { type: "SET_BUNDLE"; bundle: ComposerBundle }
  | { type: "SET_EDUCATION"; education: EducationProjection }
  | { type: "SET_VALIDATION"; validation: { status: 'clear' | 'warning' | 'error'; missing_entities: string[] } }
  | { type: "SET_ACTIVE_PANEL"; panel: ComposerState["ui"]["activePanel"] }
  | { type: "UNDO" }
  | { type: "REDO" };

function pushHistory(state: ComposerState): ComposerState {
  return {
    ...state,
    history: {
      past: [...state.history.past, state.document],
      future: [],
    },
  };
}

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  if (action.type === "LOAD_OUTFIT") {
    return { ...state, document: action.outfit, history: { past: [], future: [] } };
  }

  if (action.type === "SET_BUNDLE") {
    return { ...state, bundle: action.bundle };
  }

  if (action.type === "SET_EDUCATION") {
    return { ...state, activeEntityEducation: action.education };
  }

  if (action.type === "SET_VALIDATION") {
    return { ...state, validation: action.validation };
  }

  if (action.type === "SET_ACTIVE_PANEL") {
    return { ...state, ui: { ...state.ui, activePanel: action.panel } };
  }

  if (action.type === "UNDO") {
    const prev = state.history.past.at(-1);
    if (!prev) return state;
    return {
      ...state,
      document: prev,
      history: {
        past: state.history.past.slice(0, -1),
        future: [state.document, ...state.history.future],
      },
    };
  }

  if (action.type === "REDO") {
    const next = state.history.future[0];
    if (!next) return state;
    return {
      ...state,
      document: next,
      history: {
        past: [...state.history.past, state.document],
        future: state.history.future.slice(1),
      },
    };
  }

  const s = pushHistory(state);

  if (action.type === "ADD_SELECTION") {
    // Replace slot if already occupied
    const filtered = state.document.selections.filter((sel) => sel.slot !== action.selection.slot);
    return {
      ...s,
      document: {
        ...state.document,
        selections: [...filtered, action.selection],
      },
    };
  }

  if (action.type === "REMOVE_SELECTION") {
    return {
      ...s,
      document: {
        ...state.document,
        selections: state.document.selections.filter((sel) => sel.selection_id !== action.selectionId),
      },
      selectedSelectionId: state.selectedSelectionId === action.selectionId ? null : state.selectedSelectionId,
    };
  }

  if (action.type === "SET_STYLE") {
    return {
      ...s,
      document: {
        ...state.document,
        selections: state.document.selections.map((sel) =>
          sel.selection_id === action.selectionId
            ? { ...sel, style: { ...sel.style, ...action.patch } }
            : sel
        ),
      },
    };
  }

  return state;
}

