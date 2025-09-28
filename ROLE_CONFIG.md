# Role Configuration Guide

## Overview

The nb_sync extension now uses hard-coded role determination instead of environment variables to avoid configuration mismatches between frontend and backend.

## How to Configure Roles

### For Teacher Instance

The default configuration is already set for teacher mode. No changes needed.

### For Student Instance

To configure a JupyterLab instance as a student:

1. **Edit Backend Role (Required)**
   - Open `nb_sync/simple_auth.py`
   - Change line in `get_user_role()` function:
     ```python
     return 'student'  # Change from 'teacher' to 'student'
     ```

2. **Edit Handler Role (Required)**  
   - Open `nb_sync/handlers.py`
   - Change line in `get_current_role()` function:
     ```python
     return 'student'  # Change from 'teacher' to 'student'
     ```

3. **Restart JupyterLab**
   - Stop and restart the JupyterLab server for changes to take effect

## Verification

After restarting, you can verify the role by:
1. Opening browser developer console
2. Looking for the initialization log: `Extension initialized in [role] mode (hard-coded in backend)`

## Benefits

✅ **Fixed**: No more role mismatch between frontend and backend  
✅ **Simplified**: No environment variable configuration needed  
✅ **Reliable**: Role is consistently determined from single source  
✅ **Clear**: Easy to see and modify role configuration  

## Migration from Environment Variables

If you were previously using `JUPYTER_TEACHER_MODE` environment variable:
- You can remove this environment variable - it's no longer used
- Follow the steps above to configure roles directly in code