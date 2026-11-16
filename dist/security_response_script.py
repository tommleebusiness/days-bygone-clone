#!/usr/bin/env python3
"""
Windows 11 Security Response Script
Monitors failed password attempts and triggers security responses

Features:
- Monitors Windows Security Event Log for failed RDP login attempts
- Triggers when 2 consecutive failed passwords detected
- Closes all RDP sessions
- Executes secondary script
- Closes Explorer, Notepad, and archiver windows
- Deletes specified files

Requirements:
- pip install pywin32 psutil
- Run as Administrator for event log access
- Edit CONFIGURATION section below

WARNING: This script modifies system state and deletes files.
Use only for authorized security purposes.
"""

import os
import sys
import time
import ctypes
import psutil
import win32event
import win32con
import win32api
import win32security
import win32evtlog
import win32evtlogutil
import win32process
from collections import deque

# ============================================================================
# CONFIGURATION - EDIT THESE SETTINGS
# ============================================================================

# Number of failed password attempts to trigger response
FAILED_ATTEMPTS_THRESHOLD = 2

# Wait time between checking event log (seconds)
CHECK_INTERVAL = 5

# Self-delete script after completion (True/False)
SELF_DELETE = False

# Secondary scripts to execute after trigger (list of paths)
SECONDARY_SCRIPTS = [
    r"C:\path\to\script1.py",
    r"C:\path\to\script2.bat",
]

# Command delays before each script execution (seconds, one per script)
COMMAND_DELAYS = [
    0,  # Delay before script1
    2,  # Delay before script2
]

# Files to delete (add/remove as needed)
FILES_TO_DELETE = [
    r"C:\path\to\file1.txt",      # CHANGE THIS
    r"C:\path\to\file2.txt",      # CHANGE THIS
    # r"C:\path\to\important.db", # Uncomment to add more
]

# Processes to close (window titles/contain matching)
PROCESS_TERMINATION_LIST = [
    "explorer.exe",       # Windows Explorer
    "notepad.exe",      # Notepad
    "winrar.exe",       # WinRAR
    "7z.exe",           # 7-Zip
    "winzip.exe",       # WinZip
]

# ============================================================================
# END CONFIGURATION
# ============================================================================

# Event log source names for RDP authentication
RDP_EVENT_SOURCES = ["Microsoft-Windows-TerminalServices-LocalSessionManager", 
                     "Microsoft-Windows-Security-Auditing"]

# Track failed attempts
failed_attempts = deque(maxlen=FAILED_ATTEMPTS_THRESHOLD)

# Event log source names for RDP authentication
RDP_EVENT_SOURCES = ["Microsoft-Windows-TerminalServices-LocalSessionManager", 
                     "Microsoft-Windows-Security-Auditing"]

# Track failed attempts
failed_attempts = deque(maxlen=FAILED_ATTEMPTS_THRESHOLD)


def get_current_username():
    """Get current logged-on user"""
    try:
        return win32api.GetUserName()
    except:
        return "unknown"


def is_admin():
    """Check if script runs with admin rights"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False


def terminate_processes_by_name(process_names):
    """Terminate processes matching given names"""
    terminated = []
    for proc in psutil.process_iter(['pid', 'name', 'username']):
        try:
            for name in process_names:
                if name.lower() in proc.info['name'].lower() or \
                   proc.info['name'].lower() == name.lower():
                    # Don't kill current process or critical system processes
                    if proc.pid == os.getpid():
                        continue
                    if proc.info['name'].lower() == "svc.exe":
                        continue
                    try:
                        proc.terminate()
                        terminated.append((proc.info['name'], proc.pid))
                        proc.wait(timeout=3)
                    except (psutil.NoSuchProcess, psutil.TimeoutExpired):
                        pass
        except (psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return terminated


def close_windows_by_title(title_parts):
    """Close windows matching title parts using AutoIt-like approach"""
    closed = []
    try:
        import win32gui
        def enum_handler(hwnd, ctx):
            if win32gui.IsWindow(hwnd) and win32gui.IsWindowEnabled(hwnd) and win32gui.IsWindowVisible(hwnd):
                text = win32gui.GetWindowText(hwnd)
                for part in title_parts:
                    if part.lower() in text.lower():
                        try:
                            win32gui.SendMessage(hwnd, win32con.WM_CLOSE, 0, 0)
                            closed.append(text)
                        except:
                            pass
        win32gui.EnumWindows(enum_handler, None)
    except ImportError:
        pass
    return closed


def delete_files(file_paths):
    """Permanently delete specified files"""
    deleted = []
    for filepath in file_paths:
        try:
            if os.path.exists(filepath):
                # 3-pass overwrite delete
                import hashlib
                file_size = os.path.getsize(filepath)
                if file_size > 0:
                    with open(filepath, 'r+b') as f:
                        import random
                        # Pass 1: overwrite with random data
                        random_data = bytes(random.getrandbits(8) for _ in range(min(4096, file_size)))
                        f.seek(0)
                        f.write(random_data)
                        f.flush()
                        os.fsync(f.fileno())
                        
                        # Pass 2: overwrite with complement
                        complement = bytes(255 - b for b in random_data)
                        f.seek(0)
                        f.write(complement)
                        f.flush()
                        os.fsync(f.fileno())
                        
                        # Pass 3: overwrite with zeros
                        f.seek(0)
                        f.write(bytes(file_size))
                        f.flush()
                        os.fsync(f.fileno())
                
                os.remove(filepath)
                deleted.append(filepath)
        except (PermissionError, OSError, FileNotFoundError) as e:
            pass
    return deleted


def execute_script(script_path):
    """Execute a Python or batch script"""
    executed = False
    try:
        if not os.path.exists(script_path):
            return False
        
        if script_path.lower().endswith('.py'):
            cmd = [sys.executable, script_path]
        elif script_path.lower().endswith('.bat') or script_path.lower().endswith('.cmd'):
            cmd = ['cmd', '/c', script_path]
        else:
            cmd = [script_path]
        
        # Execute in new console window
        creation_flags = win32process.CREATE_NEW_CONSOLE
        win32process.CreateProcess(
            None, cmd[0], None, None, False, creation_flags, None, None,
            win32process.STARTUPINFO()
        )
        executed = True
    except Exception as e:
        pass
    return executed


def check_rdp_events():
    """Check Windows Security Event Log for failed RDP logins"""
    events_found = []
    
    try:
        # Query Security Event Log for failed logon events
        # Event ID 4625: Failed logon attempt
        handles = win32evtlog.OpenEventLog(None, "Security")
        
        # Read events backward (newest first)
        total_events = win32evtlog.GetNumberOfEventLogRecords(handles)
        
        # Read recent events
        events = win32evtlog.ReadEventLog(
            handles, win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEEK_READ,
            0
        )
        
        for event in events:
            try:
                # Check for failed logon events (Event ID 4625)
                if event.EventID == 4625:
                    strings = event.StringInserts
                    if strings:
                        # Parse event data
                        account_name = strings[3] if len(strings) > 3 else ""
                        logon_type = strings[5] if len(strings) > 5 else ""
                        
                        # Type 10 = RDP (Remote Interactive Logon)
                        # Type 3 = Network
                        if "RDP" in str(event) or logon_type == "10":
                            events_found.append({
                                'event_id': event.EventID,
                                'time': event.TimeGenerated,
                                'account': account_name,
                                'source': event.SourceName
                            })
            except:
                continue
        
        win32evtlog.CloseEventLog(handles)
        
    except Exception as e:
        pass
    
    return events_found


def monitor_failed_logins():
    """Monitor for failed password attempts and trigger response"""
    global failed_attempts
    
    last_count = 0
    
    while True:
        try:
            # Check for failed RDP login events
            events = check_rdp_events()
            
            # Count new failed events
            new_failures = len(events)
            
            if new_failures > last_count:
                # Add new failures to tracking
                for _ in range(new_failures - last_count):
                    failed_attempts.append(1)
                
                last_count = new_failures
            
            # Check if threshold reached
            if len(failed_attempts) >= FAILED_ATTEMPTS_THRESHOLD:
                trigger_security_response()
                # Reset counter after trigger
                failed_attempts.clear()
            
            time.sleep(CHECK_INTERVAL)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            time.sleep(CHECK_INTERVAL)


def trigger_security_response():
    """Execute all security response actions"""
    print(f"\n{'='*60}")
    print(f"SECURITY TRIGGER: {FAILED_ATTEMPTS_THRESHOLD} failed password attempts detected")
    print(f"{'='*60}")
    
    actions_taken = []
    
    # 1. Close RDP sessions
    try:
        # Enumerate and disconnect RDP sessions
        import subprocess
        result = subprocess.run(
            ["query", "session", "/server:"] , 
            capture_output=True, text=True, timeout=5
        )
        # Disconnect all active RDP sessions
        result = subprocess.run(
            ["logoff", "*"] , 
            capture_output=True, text=True, timeout=5
        )
        actions_taken.append("RDP sessions closed")
    except:
        actions_taken.append("RDP close attempted")
    
    # 2. Execute secondary script
    if SECONDARY_SCRIPT and os.path.exists(SECONDARY_SCRIPT):
        try:
            executed = execute_script(SECONDARY_SCRIPT)
            if executed:
                actions_taken.append(f"Secondary script executed: {SECONDARY_SCRIPT}")
        except:
            actions_taken.append("Secondary script execution failed")
    
    # 3. Close specified processes/windows
    try:
        terminated = terminate_processes_by_name(PROCESS_TERMINATION_LIST)
        if terminated:
            actions_taken.append(f"Processes terminated: {terminated}")
    except:
        pass
    
    # Also try closing windows by title
    try:
        closed = close_windows_by_title(PROCESS_TERMINATION_LIST)
        if closed:
            actions_taken.append(f"Windows closed: {closed}")
    except:
        pass
    
    # 4. Delete specified files
    try:
        deleted = delete_files(FILES_TO_DELETE)
        if deleted:
            actions_taken.append(f"Files deleted: {len(deleted)}")
    except:
        pass
    
    # 5. Log the action
    try:
        event_log_path = r"C:\Windows\System32\winevt\Logs\Security.evtx"
        # Could add a custom event log entry here
    except:
        pass
    
    print(f"Actions taken: {', '.join(actions_taken) if actions_taken else 'None'}")
    print(f"{'='*60}\n")


def main():
    """Main entry point"""
    print("="*60)
    print("Windows 11 Security Response Script")
    print("="*60)
    print(f"Monitoring for {FAILED_ATTEMPTS_THRESHOLD} failed password attempts...")
    print(f"Secondary script: {SECONDARY_SCRIPT if SECONDARY_SCRIPT else 'NOT SET'}")
    print(f"Files to delete: {len(FILES_TO_DELETE)} files configured")
    print(f"Processes to close: {', '.join(PROCESS_TERMINATION_LIST)}")
    print()
    print("Press Ctrl+C to stop the script")
    print()
    
    # Check if running as admin
    if not is_admin():
        print("WARNING: Not running as Administrator")
        print("Event log monitoring may fail. Re-run as Administrator.")
        print()
    
    try:
        monitor_failed_logins()
    except KeyboardInterrupt:
        print("\nScript stopped by user")
    finally:
        failed_attempts.clear()


def main():
    """Main entry point"""
    print("="*60)
    print("Windows 11 Security Response Script")
    print("="*60)
    print(f"Monitoring for {FAILED_ATTEMPTS_THRESHOLD} failed password attempts...")
    print(f"Secondary scripts: {len(SECONDARY_SCRIPTS)} configured")
    print(f"Files to delete: {len(FILES_TO_DELETE)} files configured")
    print(f"Processes to close: {', '.join(PROCESS_TERMINATION_LIST)}")
    print()
    print("Press Ctrl+C to stop the script")
    print()
    
    # Check if running as admin
    if not is_admin():
        print("WARNING: Not running as Administrator")
        print("Event log monitoring may fail. Re-run as Administrator.")
        print()
    
    # Parse command-line arguments
    import sys
    args = sys.argv[1:]
    self_delete = False
    threshold = FAILED_ATTEMPTS_THRESHOLD
    delay = CHECK_INTERVAL
    
    i = 0
    while i < len(args):
        if args[i] == "--self-delete":
            self_delete = True
        elif args[i] == "--threshold" and i + 1 < len(args):
            try:
                threshold = int(args[i + 1])
            except ValueError:
                pass
        elif args[i] == "--delay" and i + 1 < len(args):
            try:
                delay = int(args[i + 1])
            except ValueError:
                pass
        i += 1
    
    # Override settings if command-line arguments provided
    if threshold != FAILED_ATTEMPTS_THRESHOLD:
        FAILED_ATTEMPTS_THRESHOLD = threshold
    if delay != CHECK_INTERVAL:
        CHECK_INTERVAL = delay
    
    # Update the deque maxlen
    global failed_attempts
    failed_attempts = deque(maxlen=FAILED_ATTEMPTS_THRESHOLD)
    
    print()
    print(f"Settings - Threshold: {FAILED_ATTEMPTS_THRESHOLD}, Check Interval: {CHECK_INTERVAL}s, Self-Delete: {self_delete}")
    print()
    print("Starting monitor...")
    print()
    
    try:
        monitor_failed_logins()
    except KeyboardInterrupt:
        print("\nScript stopped by user")
    finally:
        failed_attempts.clear()
        # Self-delete if flag set
        if self_delete:
            try:
                import time as time_mod
                time_mod.sleep(3)  # Small delay before deletion
                script_path = os.path.abspath(__file__)
                # Remove the script file (read-only safe)
                import ntsecuritycon
                import pywintypes
                try:
                    os.remove(script_path)
                    print("Script self-deleted successfully")
                except PermissionError:
                    # Try with attributes reset
                    import ctypes
                    ctypes.windll.kernel32.SetFileAttributesW(script_path, 0x80)  # FILE_ATTRIBUTE_NORMAL
                    os.remove(script_path)
                    print("Script self-deleted successfully (attrs reset)")
            except Exception as e:
                print(f"Self-delete skipped: {e}")