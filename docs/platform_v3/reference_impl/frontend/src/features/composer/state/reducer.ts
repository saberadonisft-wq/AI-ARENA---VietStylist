import type { ComposerState, OutfitSpecV2, OutfitSelection } from "./types";

type Action =
  | { type: "LOAD_OUTFIT"; outfit: OutfitSpecV2 }
  | { type: "ADD_SELECTION"; selection: OutfitSelection }
  | { type: "REMOVE_SELECTION"; selectionId: string }
  | { type: "SET_STYLE"; selectionId: string; patch: Record<string, unknown> }
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

export function composerReducer(state: ComposerState, action: Action): ComposerState {
  if (action.type === "LOAD_OUTFIT") {
    return { ...state, document: action.outfit, history: { past: [], future: [] } };
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
    return {
      ...s,
      document: {
        ...state.document,
        selections: [...state.document.selections, action.selection],
      },
    };
  }

  if (action.type === "REMOVE_SELECTION") {
    return {
      ...s,
      document: {
        ...state.document,
        selections: state.document.selections.filter(
          x => x.selection_id !== action.selectionId
        ),
      },
    };
  }

  if (action.type === "SET_STYLE") {
    return {
      ...s,
      document: {
        ...state.document,
        selections: state.document.selections.map(x =>
          x.selection_id === action.selectionId
            ? { ...x, style: { ...x.style, ...action.patch } }
            : x
        ),
      },
    };
  }

  return state;
}
