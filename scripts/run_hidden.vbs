' Generic windowless launcher for the LMO scheduled tasks (no console popup).
'   wscript.exe run_hidden.vbs <batch-file-name-in-this-folder>
' Task Scheduler running a .cmd in the interactive session flashes a console window every fire.
' wscript.exe is the windowless script host, and Run(cmd, 0, True) starts the window HIDDEN — so
' the popup is gone. The wrapped .cmd still sets its own working dir and log redirect; this only
' removes the visible console. Deployed to ~/.claude/scripts/ alongside run_mailbox_poll.cmd.
Set fso = CreateObject("Scripting.FileSystemObject")
target = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), WScript.Arguments(0))
CreateObject("WScript.Shell").Run "cmd /c """ & target & """", 0, True
