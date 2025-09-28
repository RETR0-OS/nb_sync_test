# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# NB Sync - JupyterLab Extension

## Project Overview
A JupyterLab extension that enables classroom synchronization between teacher and student notebooks. Teachers can push code blocks to student notebooks to help them keep up during class.

## Current Development Status
- ✅ Basic JupyterLab extension structure set up
- ✅ Python backend with handler.ts and index.ts
- ✅ Development environment configured (jlpm, virtual env)
- ✅ Auto-rebuild system working (jlpm watch)
- ✅ **Completed**: Add "Sync" button to top-right of each notebook cell
- 🔄 **Current Task**: Ready for next feature implementation

## Architecture
```
nb_sync_test/
├── nb_sync/           # Python package (server-side API)
│   ├── __init__.py    # Extension registration and setup
│   └── handlers.py    # Tornado-based request handlers
├── src/               # TypeScript/React frontend
│   ├── index.ts       # Main extension entry point
│   └── handler.ts     # API communication with Python backend
├── style/             # CSS styling
├── package.json       # JavaScript dependencies
└── pyproject.toml     # Python configuration
```

### Frontend (TypeScript)
- Entry point: `src/index.ts` - Main plugin registration
- API handler: `src/handler.ts` - Communication with Python backend
- Uses JupyterLab 4.0+ APIs for application integration
- Frontend communicates with backend via `/nb-sync/*` API endpoints

### Backend (Python)
- Main module: `nb_sync/__init__.py` - Extension registration and setup
- API handlers: `nb_sync/handlers.py` - Tornado-based request handlers
- Uses Jupyter Server extension points for integration
- Provides example endpoint at `/nb-sync/get-example`

## Development Environment
- **Python**: Virtual environment with pip for package management
- **JavaScript**: jlpm (JupyterLab's yarn) for package management
- **Build**: Auto-rebuild with `jlpm watch`
- **JupyterLab**: Extension installed in development mode

## Key Development Commands

### Building and Development
- `jlpm build` - Build both library and labextension in development mode
- `jlpm build:prod` - Clean build for production
- `jlpm watch` - Watch source directory and automatically rebuild
- `jupyter lab` - Run JupyterLab (use in separate terminal with watch)

### Code Quality
- `jlpm lint` - Run all linters (stylelint, prettier, eslint)
- `jlpm lint:check` - Check without fixing
- `jlpm eslint` - Run ESLint with fixes
- `jlpm prettier` - Format code with Prettier

### Extension Management
- `pip install -e "."` - Install Python package in development mode
- `jupyter labextension develop . --overwrite` - Link frontend extension
- `jupyter server extension enable nb_sync` - Enable server extension
- `jupyter labextension list` - Check frontend extension status
- `jupyter server extension list` - Check server extension status

## Development Workflow
1. Install in development mode: `pip install -e "."`
2. Link extension: `jupyter labextension develop . --overwrite`
3. Enable server: `jupyter server extension enable nb_sync`
4. Start watch mode: `jlpm watch`
5. Run JupyterLab in separate terminal: `jupyter lab`

## Current Goal
✅ **COMPLETED**: Sync button implementation
- Added "Sync" button to top-right corner of each notebook cell
- Visual element with hover effects (no functionality yet)
- Integrated with JupyterLab's cell UI system
- Styled to match JupyterLab design system
- Button appears on cell hover, hidden by default

## Code Style
- ESLint configuration enforces PascalCase interfaces with `I` prefix
- Single quotes preferred, no trailing commas
- Prettier formatting with specific overrides for package.json
- Stylelint for CSS validation

## Package Management
- Frontend: Uses `jlpm` (JupyterLab's yarn) for TypeScript/JS dependencies
- Backend: Uses pip/pyproject.toml for Python dependencies
- Built extension goes to `nb_sync/labextension/` directory

## Technical Notes
- Using JupyterLab 4.x extension system
- Extension registered with both frontend and backend components
- Communication via Jupyter server extensions
- Cell modification requires hooking into JupyterLab's cell widget system

## Dependencies
- JupyterLab UI Components
- React (for future UI components)
- Jupyter Server extensions
- TypeScript build toolchain

## Change History & Rollback Instructions
*Claude: Please update this section with each change you make, including the files modified and how to undo the changes*

### Change Log
- **Initial Setup**: Basic JupyterLab extension structure created
  - Files: All initial files from extension template
  - To undo: Revert to initial commit or re-run extension setup

- **Sync Button Implementation**: Added visual sync button to notebook cells
  - Files Modified:
    - `src/index.ts`: Added notebook cell tracking, button creation, and DOM manipulation
    - `style/base.css`: Added CSS styling for sync button and hover effects
  - Features Added:
    - Button appears in top-right corner of each cell on hover
    - Placeholder click handler (logs to console)
    - JupyterLab-compatible styling with brand colors
    - Automatic button addition to new cells
  - To undo:
    1. Revert `src/index.ts` to previous version (remove all cell tracking code)
    2. Remove sync button CSS from `style/base.css`
    3. Run `jlpm build` to rebuild extension

### Rollback Instructions
*Each change should include:*
1. **Change Description**: What was modified
2. **Files Affected**: List of files changed/added/deleted
3. **Undo Steps**: Specific commands or file reversions to rollback
4. **Backup Info**: Any backup file locations if applicable

---

## Instructions for Claude Code
- **Refer to this file** for project context and current status
- **Update this file** as development progresses, especially:
  - Current Development Status section
  - Current Goal section
  - Change History with rollback instructions for each modification
- **Document all changes** in the Change History section with clear undo instructions