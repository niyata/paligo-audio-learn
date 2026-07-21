# Reference Workspace Modes

Status: prototype slice implemented in `workbook.html`

Last updated: 2026-07-21

## Goal

Paligo should let users open a reference text beside an answer workbook in the
layout that best fits their device:

- floating window
- docked side-by-side panel
- docked top-bottom panel

The feature keeps one reader implementation and changes only the workspace host
layout. PiP tooltip, breadcrumb, annotation, exam-marker, and ghost suggestion
logic must not be forked into separate versions for each layout.

## UX Rules

- Default stays **floating** so existing desktop behavior does not regress.
- Users can switch modes from the reference toolbar.
- Docked side-by-side and top-bottom modes expose a draggable splitter.
- Narrow tablet/mobile viewports force side-by-side into top-bottom.
- The last selected mode and panel size are saved locally.
- Closing the reference panel must restore the workbook to a full-width layout.

## Architecture Direction

Current slice:

- `workbook.html` hosts the existing `pali-reference-pip.html` iframe.
- `Reference Workspace Modes` are implemented at the host/layout layer only.

Next slices:

- Extract `ReferenceReaderCore` from `pali-reference-pip.html`:
  corpus loading, breadcrumb, token lookup, tooltip, annotation tools.
- Extract `ReferenceWorkspaceHost`:
  floating, docked side, docked stack, fullscreen, saved layout state.
- Mount the same reader core from workbook, PiP, future audio practice reader,
  and future course reader.

## Acceptance Criteria

- Floating mode preserves existing drag/resize behavior.
- Side-by-side mode shows reference and workbook simultaneously with a vertical
  splitter.
- Top-bottom mode shows reference above workbook with a horizontal splitter.
- On narrow viewports, side-by-side mode falls back to top-bottom.
- The iframe keeps sending reference context `postMessage` to workbook.
- Ghost suggestion and PAT tooltip behavior remain unchanged.
